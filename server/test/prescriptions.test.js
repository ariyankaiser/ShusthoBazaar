import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shusthobazaar-rx-'));
process.env.DB_PATH = path.join(temporaryDirectory, 'test.sqlite');
process.env.UPLOAD_DIR = path.join(temporaryDirectory, 'uploads');
process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';

const [{ createApp }, { seed }, { db, closeDatabase }] = await Promise.all([
  import('../src/app.ts'),
  import('../db/seed.js'),
  import('../db/index.js'),
]);

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake image body for tests'),
]);
const PDF = Buffer.from('%PDF-1.4\n% test prescription\n');

let app;
let baseUrl;
let customerCookie;
let otherCustomerCookie;
let sellerCookie;
let seller2Cookie;
let addressId;

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function call(method, url, cookie, body) {
  return fetch(`${baseUrl}/api${url}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function upload(cookie, buffer, name, type = 'application/octet-stream') {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), name);
  return fetch(`${baseUrl}/api/prescriptions`, { method: 'POST', headers: { cookie }, body: form });
}

before(async () => {
  seed();
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  customerCookie = await login('customer@shusthobazaar.demo', 'Customer123!');
  sellerCookie = await login('seller@shusthobazaar.demo', 'Seller123!');
  seller2Cookie = await login('seller2@shusthobazaar.demo', 'Seller2123!');
  const other = await call('POST', '/auth/register', '', {
    name: 'Other Customer', email: 'other@example.test', password: 'CustomerPassword123',
  });
  otherCustomerCookie = other.headers.get('set-cookie').split(';', 1)[0];

  const address = await call('POST', '/addresses', customerCookie, {
    recipient: 'Aminul Islam', phone: '01712345678', street: 'House 42, Banani', city: 'Dhaka',
  });
  addressId = (await address.json()).addresses[0].id;
});

after(async () => {
  await app.close();
  closeDatabase();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('uploads are validated by content, size and role', async () => {
  const text = await upload(customerCookie, Buffer.from('not an image'), 'note.png', 'image/png');
  assert.equal(text.status, 415);

  const tooLarge = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
  assert.equal((await upload(customerCookie, tooLarge, 'big.png', 'image/png')).status, 413);

  assert.equal((await upload(sellerCookie, PNG, 'rx.png', 'image/png')).status, 403);
  const missing = await fetch(`${baseUrl}/api/prescriptions`, {
    method: 'POST', headers: { cookie: customerCookie }, body: new FormData(),
  });
  assert.equal(missing.status, 400);

  const pdf = await upload(customerCookie, PDF, '../../etc/report.pdf', 'text/plain');
  assert.equal(pdf.status, 201);
  const prescription = (await pdf.json()).prescription;
  assert.match(prescription.id, /^RX-\d{6}$/);
  assert.equal(prescription.fileType, 'application/pdf');
  assert.equal(prescription.fileName, 'report.pdf');

  const file = await fetch(`${baseUrl}${prescription.fileUrl}`, { headers: { cookie: customerCookie } });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), PDF);
  const foreign = await fetch(`${baseUrl}${prescription.fileUrl}`, { headers: { cookie: otherCustomerCookie } });
  assert.equal(foreign.status, 404);
  const unlinkedSeller = await fetch(`${baseUrl}${prescription.fileUrl}`, { headers: { cookie: sellerCookie } });
  assert.equal(unlinkedSeller.status, 404);
});

test('checkout requires a prescription and each pharmacy verifies it before confirming', async () => {
  // p002 Seclo (Rx, Lazz Pharma), p009 Fexo (Rx, Tamanna Pharmacy), p001 Napa (OTC, Lazz Pharma).
  for (const productId of ['p002', 'p009', 'p001']) {
    assert.equal((await call('POST', '/cart/items', customerCookie, { productId, quantity: 1 })).status, 201);
  }
  const withoutRx = await call('POST', '/checkout', customerCookie, { addressId, paymentMethod: 'cod' });
  assert.equal(withoutRx.status, 422);

  const otherUpload = await upload(otherCustomerCookie, PNG, 'other.png', 'image/png');
  const otherId = (await otherUpload.json()).prescription.id;
  const foreignRx = await call('POST', '/checkout', customerCookie, { addressId, paymentMethod: 'cod', prescriptionId: otherId });
  assert.equal(foreignRx.status, 404);

  const uploaded = await upload(customerCookie, PNG, 'rx-photo.png', 'image/png');
  assert.equal(uploaded.status, 201);
  const rx = (await uploaded.json()).prescription;
  const checkout = await call('POST', '/checkout', customerCookie, { addressId, paymentMethod: 'cod', prescriptionId: rx.id });
  assert.equal(checkout.status, 201);
  const orders = (await checkout.json()).orders;
  assert.equal(orders.length, 2);
  assert.ok(orders.every((order) => order.prescription?.status === 'pending' && order.prescription.id === rx.id));
  const lazzOrder = orders.find((order) => order.sellerId === 's002');
  const tamannaOrder = orders.find((order) => order.sellerId === 's003');

  const lazzQueue = await (await call('GET', '/prescriptions/reviews', sellerCookie)).json();
  assert.deepEqual(lazzQueue.reviews.map((review) => review.orderId), [lazzOrder.id]);
  assert.equal(lazzQueue.counts.pending, 1);
  assert.deepEqual(lazzQueue.reviews[0].items, [{ name: 'Seclo 20mg', quantity: 1 }]);
  assert.equal((await call('GET', '/prescriptions/reviews', customerCookie)).status, 403);

  const sellerFile = await fetch(`${baseUrl}${rx.fileUrl}`, { headers: { cookie: sellerCookie } });
  assert.equal(sellerFile.status, 200);
  assert.equal(sellerFile.headers.get('content-type'), 'image/png');

  const tooEarly = await call('PATCH', `/orders/${lazzOrder.id}/status`, sellerCookie, { status: 'confirmed' });
  assert.equal(tooEarly.status, 409);
  const foreignReview = await call('PATCH', `/prescriptions/reviews/${lazzOrder.id}`, seller2Cookie, { decision: 'approved' });
  assert.equal(foreignReview.status, 404);
  const noReason = await call('PATCH', `/prescriptions/reviews/${lazzOrder.id}`, sellerCookie, { decision: 'rejected' });
  assert.equal(noReason.status, 422);

  const rejected = await call('PATCH', `/prescriptions/reviews/${lazzOrder.id}`, sellerCookie, {
    decision: 'rejected', reason: 'Prescription date is not readable.',
  });
  assert.equal(rejected.status, 200);
  const rejectedOrder = (await rejected.json()).order;
  assert.equal(rejectedOrder.prescription.status, 'rejected');
  assert.equal(rejectedOrder.prescription.rejectionReason, 'Prescription date is not readable.');
  assert.equal(rejectedOrder.status, 'Placed');

  const customerView = await (await call('GET', `/orders/${lazzOrder.id}`, customerCookie)).json();
  assert.equal(customerView.prescription.statusLabel, 'Rejected');

  const replacement = await upload(customerCookie, PDF, 'clearer-scan.pdf', 'application/pdf');
  const replacementId = (await replacement.json()).prescription.id;
  const resubmitted = await call('POST', `/orders/${lazzOrder.id}/prescription`, customerCookie, { prescriptionId: replacementId });
  assert.equal(resubmitted.status, 200);
  assert.equal((await resubmitted.json()).order.prescription.status, 'pending');
  const notRejected = await call('POST', `/orders/${tamannaOrder.id}/prescription`, customerCookie, { prescriptionId: replacementId });
  assert.equal(notRejected.status, 409);

  const approved = await call('PATCH', `/prescriptions/reviews/${lazzOrder.id}`, sellerCookie, { decision: 'approved' });
  assert.equal(approved.status, 200);
  assert.equal((await call('PATCH', `/prescriptions/reviews/${lazzOrder.id}`, sellerCookie, { decision: 'approved' })).status, 409);
  const confirmed = await call('PATCH', `/orders/${lazzOrder.id}/status`, sellerCookie, { status: 'confirmed' });
  assert.equal(confirmed.status, 200);
  const lateReview = await call('PATCH', `/prescriptions/reviews/${lazzOrder.id}`, sellerCookie, { decision: 'rejected', reason: 'x' });
  assert.equal(lateReview.status, 409);

  // The other pharmacy reviews its own copy independently.
  const tamannaQueue = await (await call('GET', '/prescriptions/reviews?status=pending', seller2Cookie)).json();
  assert.deepEqual(tamannaQueue.reviews.map((review) => review.orderId), [tamannaOrder.id]);
  assert.equal((await call('PATCH', `/prescriptions/reviews/${tamannaOrder.id}`, seller2Cookie, { decision: 'approved' })).status, 200);
  assert.equal((await call('PATCH', `/orders/${tamannaOrder.id}/status`, seller2Cookie, { status: 'confirmed' })).status, 200);

  const history = await (await call('GET', '/prescriptions', customerCookie)).json();
  assert.equal(history.prescriptions.length, 3);
  assert.equal(history.prescriptions.find((entry) => entry.id === rx.id).reviews[0].orderId, tamannaOrder.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM order_prescriptions').get().count, 2);
});

test('OTC-only checkout does not need a prescription', async () => {
  await call('POST', '/cart/items', customerCookie, { productId: 'p001', quantity: 1 });
  const checkout = await call('POST', '/checkout', customerCookie, { addressId, paymentMethod: 'cod' });
  assert.equal(checkout.status, 201);
  const [order] = (await checkout.json()).orders;
  assert.equal(order.requiresPrescription, false);
  assert.equal(order.prescription, null);
  assert.equal((await call('PATCH', `/orders/${order.id}/status`, sellerCookie, { status: 'confirmed' })).status, 200);
});
