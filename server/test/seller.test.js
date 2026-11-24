import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shusthobazaar-seller-'));
process.env.DB_PATH = path.join(temporaryDirectory, 'test.sqlite');
process.env.UPLOAD_DIR = path.join(temporaryDirectory, 'uploads');
process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';

const [{ createApp }, { seed }, { db, closeDatabase }] = await Promise.all([
  import('../src/app.ts'),
  import('../db/seed.js'),
  import('../db/index.js'),
]);

let app;
let baseUrl;
let customerCookie;
let sellerCookie;
let seller2Cookie;
let adminCookie;

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function call(method, url, cookie, body) {
  return fetch(`${baseUrl}/api${url}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

before(async () => {
  seed();
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  customerCookie = await login('customer@shusthobazaar.demo', 'Customer123!');
  sellerCookie = await login('seller@shusthobazaar.demo', 'Seller123!');
  seller2Cookie = await login('seller2@shusthobazaar.demo', 'Seller2123!');
  adminCookie = await login('admin@shusthobazaar.demo', 'Admin123!');
});

after(async () => {
  await app.close();
  closeDatabase();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('seed creates two pharmacies and each seller sees only its own inventory', async () => {
  const stores = await call('GET', '/seller/stores', adminCookie);
  assert.equal(stores.status, 200);
  assert.deepEqual((await stores.json()).sellers.map((seller) => seller.storeName).sort(), [
    'Lazz Pharma Dhanmondi',
    'Tamanna Pharmacy Mirpur',
  ]);
  assert.equal((await call('GET', '/seller/stores', sellerCookie)).status, 403);

  const first = (await (await call('GET', '/seller/products', sellerCookie)).json()).products;
  const second = (await (await call('GET', '/seller/products', seller2Cookie)).json()).products;
  assert.equal(first.length, 14);
  assert.equal(second.length, 8);
  assert.ok(first.every((product) => product.sellerId === 's002'));
  assert.ok(second.every((product) => product.sellerId === 's003'));

  const all = (await (await call('GET', '/seller/products', adminCookie)).json()).products;
  assert.equal(all.length, 22);
  const scoped = await call('GET', '/seller/products?sellerId=s003', adminCookie);
  assert.equal((await scoped.json()).products.length, 8);
  assert.equal((await call('GET', '/seller/products?sellerId=s003', sellerCookie)).status, 404);
  assert.equal((await call('GET', '/seller/products', customerCookie)).status, 403);
});

test('sellers create, update, hide and delete only their own products', async () => {
  const created = await call('POST', '/seller/products', sellerCookie, {
    name: 'Test Syrup',
    generic: 'Example generic',
    categoryId: 'c1',
    price: 120.5,
    stock: 12,
    lowStockThreshold: 5,
    requiresPrescription: true,
    image: '/images/Seclo-20-20mg-300x300.webp',
  });
  assert.equal(created.status, 201);
  const product = (await created.json()).product;
  assert.equal(product.sellerId, 's002');
  assert.equal(product.price, 120.5);
  assert.equal(product.requiresPrescription, true);

  const invalid = await call('POST', '/seller/products', sellerCookie, {
    name: 'Bad', categoryId: 'c1', price: -1, stock: 1,
  });
  assert.equal(invalid.status, 400);

  const updated = await call('PATCH', `/seller/products/${product.id}`, sellerCookie, {
    price: 99,
    stock: 3,
    isAvailable: false,
  });
  assert.equal(updated.status, 200);
  const updatedProduct = (await updated.json()).product;
  assert.equal(updatedProduct.price, 99);
  assert.equal(updatedProduct.isLowStock, true);
  assert.equal(updatedProduct.isAvailable, false);

  const hidden = await fetch(`${baseUrl}/api/products/${product.id}`);
  assert.equal(hidden.status, 404);

  const foreignUpdate = await call('PATCH', `/seller/products/${product.id}`, seller2Cookie, { price: 1 });
  assert.equal(foreignUpdate.status, 404);
  const foreignDelete = await call('DELETE', `/seller/products/${product.id}`, seller2Cookie);
  assert.equal(foreignDelete.status, 404);

  assert.equal((await call('DELETE', `/seller/products/${product.id}`, sellerCookie)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM products').get().count, 22);

  const adminWithoutSeller = await call('POST', '/seller/products', adminCookie, {
    name: 'Admin item', categoryId: 'c1', price: 10, stock: 1,
  });
  assert.equal(adminWithoutSeller.status, 422);
  const adminCreated = await call('POST', '/seller/products', adminCookie, {
    name: 'Admin item', categoryId: 'c1', price: 10, stock: 1, sellerId: 's003',
  });
  assert.equal(adminCreated.status, 201);
  assert.equal((await adminCreated.json()).product.sellerName, 'Tamanna Pharmacy Mirpur');
});

test('orders are split per pharmacy, rejection restores stock, and the dashboard reports earnings', async () => {
  const address = await call('POST', '/addresses', customerCookie, {
    recipient: 'Aminul Islam', phone: '01712345678', street: 'House 42, Banani', city: 'Dhaka',
  });
  const addressId = (await address.json()).addresses[0].id;
  // p001 belongs to Lazz Pharma, p008 (Alatrol) to Tamanna Pharmacy.
  await call('POST', '/cart/items', customerCookie, { productId: 'p001', quantity: 2 });
  await call('POST', '/cart/items', customerCookie, { productId: 'p008', quantity: 3 });
  const checkout = await call('POST', '/checkout', customerCookie, { addressId, paymentMethod: 'cod' });
  assert.equal(checkout.status, 201);
  const orders = (await checkout.json()).orders;
  assert.equal(orders.length, 2);
  const lazzOrder = orders.find((order) => order.sellerId === 's002');
  const tamannaOrder = orders.find((order) => order.sellerId === 's003');

  const sellerOrders = (await (await call('GET', '/orders', sellerCookie)).json()).orders;
  assert.deepEqual(sellerOrders.map((order) => order.id), [lazzOrder.id]);

  const stockBefore = db.prepare('SELECT stock_qty FROM products WHERE id = 8').get().stock_qty;
  const foreignReject = await call('POST', `/orders/${tamannaOrder.id}/reject`, sellerCookie, { reason: 'Out of stock' });
  assert.equal(foreignReject.status, 404);
  const noReason = await call('POST', `/orders/${tamannaOrder.id}/reject`, seller2Cookie, {});
  assert.equal(noReason.status, 400);
  const rejected = await call('POST', `/orders/${tamannaOrder.id}/reject`, seller2Cookie, { reason: 'Batch recalled' });
  assert.equal(rejected.status, 200);
  const rejectedOrder = (await rejected.json()).order;
  assert.equal(rejectedOrder.status, 'Rejected');
  assert.equal(rejectedOrder.rejectionReason, 'Batch recalled');
  assert.equal(db.prepare('SELECT stock_qty FROM products WHERE id = 8').get().stock_qty, stockBefore + 3);
  assert.equal((await call('POST', `/orders/${tamannaOrder.id}/reject`, seller2Cookie, { reason: 'Again' })).status, 409);

  for (const status of ['confirmed', 'out_for_delivery', 'delivered']) {
    assert.equal((await call('PATCH', `/orders/${lazzOrder.id}/status`, sellerCookie, { status })).status, 200);
  }

  const dashboard = await (await call('GET', '/seller/dashboard', sellerCookie)).json();
  assert.equal(dashboard.sellerId, 's002');
  assert.equal(dashboard.metrics.totalOrders, 1);
  assert.equal(dashboard.metrics.deliveredOrders, 1);
  assert.equal(dashboard.metrics.earnings, lazzOrder.total);
  assert.equal(dashboard.metrics.pendingEarnings, 0);
  assert.equal(dashboard.topProducts[0].id, 'p001');
  assert.equal(dashboard.monthlySales.length, 6);
  assert.equal(dashboard.monthlySales.at(-1).sales, lazzOrder.total);

  const secondDashboard = await (await call('GET', '/seller/dashboard', seller2Cookie)).json();
  assert.equal(secondDashboard.metrics.rejectedOrders, 1);
  assert.equal(secondDashboard.metrics.earnings, 0);
  assert.equal(secondDashboard.metrics.pendingEarnings, 0);

  const platform = await (await call('GET', '/seller/dashboard', adminCookie)).json();
  assert.equal(platform.sellerId, null);
  assert.equal(platform.metrics.totalOrders, 2);
});
