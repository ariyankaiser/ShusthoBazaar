import { db } from '../../db/index.js';
import { AppError } from '../middleware/errors.js';
import { assertOrderAccess, ensureInvoice, getOrderView } from './orders.js';

const forwardTransitions = {
  placed: 'confirmed',
  confirmed: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

function assertRoleAccess(order, auth) {
  if (auth.role === 'admin') return;
  if (auth.role === 'customer' && order.customer_id === auth.id) return;
  if (auth.role === 'seller' && order.seller_id === auth.sellerId) return;
  throw new AppError(404, 'Order not found.');
}

// A pharmacy must verify the prescription before it confirms an order that
// contains prescription-only medicine.
function assertPrescriptionApproved(orderId) {
  const needsPrescription = db.prepare(`
    SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ? AND p.requires_prescription = 1 LIMIT 1
  `).get(orderId);
  if (!needsPrescription) return;
  const review = db.prepare('SELECT status FROM order_prescriptions WHERE order_id = ?').get(orderId);
  if (!review) {
    throw new AppError(409, 'This order has prescription-only medicine but no prescription. Reject the order instead.');
  }
  if (review.status !== 'approved') {
    throw new AppError(409, 'Verify and approve the prescription before confirming this order.');
  }
}

export function rejectOrder(orderId, reason, auth) {
  const transaction = db.transaction(() => {
    const order = db.prepare('SELECT id, customer_id, seller_id, status FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new AppError(404, 'Order not found.');
    assertRoleAccess(order, auth);
    if (order.status !== 'placed' && order.status !== 'confirmed') {
      throw new AppError(409, `An order that is ${order.status.replaceAll('_', ' ')} cannot be rejected.`);
    }

    db.prepare("UPDATE orders SET status = 'rejected', rejection_reason = ? WHERE id = ?").run(reason, orderId);
    db.prepare(
      "INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, 'rejected', ?)",
    ).run(orderId, auth.id);
    // Return the reserved units to inventory.
    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
    const restock = db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?');
    for (const item of items) restock.run(item.quantity, item.product_id);
  });
  transaction();
  return getOrderView(orderId);
}

export function listOrders(auth) {
  let rows;
  if (auth.role === 'admin') {
    rows = db.prepare('SELECT id FROM orders ORDER BY placed_at DESC, id DESC').all();
  } else if (auth.role === 'seller') {
    rows = db.prepare('SELECT id FROM orders WHERE seller_id = ? ORDER BY placed_at DESC, id DESC')
      .all(auth.sellerId);
  } else {
    rows = db.prepare('SELECT id FROM orders WHERE customer_id = ? ORDER BY placed_at DESC, id DESC')
      .all(auth.id);
  }
  return rows.map(({ id }) => getOrderView(id));
}

export function getAuthorizedOrder(orderId, auth) {
  const order = assertOrderAccess(orderId, auth);
  assertRoleAccess(order, auth);
  ensureInvoice(orderId);
  return getOrderView(orderId);
}

export function getAuthorizedInvoice(orderId, auth) {
  const order = assertOrderAccess(orderId, auth);
  assertRoleAccess(order, auth);
  const invoice = ensureInvoice(orderId);
  const view = getOrderView(orderId);
  return {
    id: invoice.invoice_no,
    invoiceNo: invoice.invoice_no,
    orderId: view.id,
    customer: view.customer,
    customerEmail: view.customerEmail,
    address: view.address,
    paymentMethod: view.paymentMethod,
    paymentStatus: view.paymentStatus,
    paymentReference: view.paymentReference,
    createdAt: view.createdAt,
    issuedAt: invoice.issued_at,
    items: view.items.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
    subtotal: view.subtotal,
    discount: view.discount,
    deliveryFee: view.shippingFee,
    shippingFee: view.shippingFee,
    total: view.total,
  };
}

export function advanceOrderStatus(orderId, nextStatus, auth) {
  const transaction = db.transaction(() => {
    const order = db.prepare('SELECT id, customer_id, seller_id, status FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new AppError(404, 'Order not found.');
    assertRoleAccess(order, auth);
    if (forwardTransitions[order.status] !== nextStatus) {
      throw new AppError(409, `Order cannot move from ${order.status} to ${nextStatus}.`);
    }
    if (nextStatus === 'confirmed') assertPrescriptionApproved(orderId);

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(nextStatus, orderId);
    db.prepare(
      'INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, ?, ?)',
    ).run(orderId, nextStatus, auth.id);

    if (nextStatus === 'delivered') {
      db.prepare(`
        UPDATE payments SET status = 'success', paid_at = CURRENT_TIMESTAMP
        WHERE order_id = ? AND method = 'cod' AND status = 'pending'
      `).run(orderId);
    }
  });
  transaction();
  const view = getOrderView(orderId);
  if (view.payment?.method === 'cod' && view.payment.status === 'success') ensureInvoice(orderId);
  return getOrderView(orderId);
}
