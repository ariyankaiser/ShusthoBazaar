import { db } from '../../db/index.js';
import { AppError } from '../middleware/errors.js';
import { publicProductId, publicSellerId } from '../utils/ids.js';
import { getOrderView } from './orders.js';

const OPEN_STATUSES = "('placed', 'confirmed', 'out_for_delivery')";
const CLOSED_STATUSES = "('rejected', 'cancelled')";

// Sellers always act on their own pharmacy. Admins may pick one pharmacy or,
// for read-only views, see every pharmacy (null).
export function resolveSellerScope(auth, requestedSellerId: number | null) {
  if (auth.role === 'seller') {
    if (!auth.sellerId) throw new AppError(403, 'This account is not linked to a pharmacy.');
    if (requestedSellerId && requestedSellerId !== auth.sellerId) throw new AppError(404, 'Seller not found.');
    return auth.sellerId;
  }
  if (requestedSellerId) assertSellerExists(requestedSellerId);
  return requestedSellerId;
}

function assertSellerExists(sellerId: number) {
  const seller = db.prepare('SELECT id FROM sellers WHERE id = ?').get(sellerId);
  if (!seller) throw new AppError(404, 'Seller not found.');
}

export function listSellers() {
  return db.prepare(`
    SELECT s.id, s.pharmacy_name, s.city, s.status, u.full_name AS owner,
           (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id) AS product_count
    FROM sellers s JOIN users u ON u.id = s.user_id
    ORDER BY s.pharmacy_name
  `).all().map((row) => ({
    id: publicSellerId(row.id),
    storeName: row.pharmacy_name,
    city: row.city,
    status: row.status,
    owner: row.owner,
    productCount: row.product_count,
  }));
}

function mapSellerProduct(row) {
  return {
    id: publicProductId(row.id),
    name: row.name,
    generic: row.generic_name || '',
    description: row.description || '',
    price: row.price / 100,
    categoryId: `c${row.category_id}`,
    category: row.category,
    stock: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    isLowStock: row.stock_qty <= row.low_stock_threshold,
    requiresPrescription: Boolean(row.requires_prescription),
    isAvailable: Boolean(row.is_active),
    image: row.image || '/images/napa-extra-paracetamol-box-and-tablet-strip.webp',
    sellerId: publicSellerId(row.seller_id),
    sellerName: row.pharmacy_name,
    unitsSold: row.units_sold,
  };
}

const sellerProductQuery = `
  SELECT p.*, c.name AS category, s.pharmacy_name,
         (SELECT image_url FROM product_images pi
          WHERE pi.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
         (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id AND o.status NOT IN ${CLOSED_STATUSES}) AS units_sold
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN sellers s ON s.id = p.seller_id
`;

export function listSellerProducts(sellerId: number | null) {
  const rows = sellerId
    ? db.prepare(`${sellerProductQuery} WHERE p.seller_id = ? ORDER BY p.name`).all(sellerId)
    : db.prepare(`${sellerProductQuery} ORDER BY s.pharmacy_name, p.name`).all();
  return rows.map(mapSellerProduct);
}

function getOwnedProduct(productId: number, auth) {
  const product = db.prepare('SELECT id, seller_id FROM products WHERE id = ?').get(productId);
  if (!product || (auth.role === 'seller' && product.seller_id !== auth.sellerId)) {
    throw new AppError(404, 'Product not found.');
  }
  return product;
}

function assertCategoryExists(categoryId: number) {
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)) {
    throw new AppError(422, 'Choose an existing category.');
  }
}

type ProductInput = {
  name?: string;
  generic?: string;
  description?: string;
  categoryId?: number;
  price?: number;
  stock?: number;
  lowStockThreshold?: number;
  requiresPrescription?: boolean;
  isAvailable?: boolean;
  image?: string;
};

export function createSellerProduct(sellerId: number, input: ProductInput) {
  assertSellerExists(sellerId);
  assertCategoryExists(input.categoryId);
  const create = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO products
        (seller_id, category_id, name, generic_name, description, price, stock_qty,
         low_stock_threshold, requires_prescription, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sellerId,
      input.categoryId,
      input.name,
      input.generic || null,
      input.description || null,
      Math.round(input.price * 100),
      input.stock,
      input.lowStockThreshold ?? 10,
      input.requiresPrescription ? 1 : 0,
      input.isAvailable === false ? 0 : 1,
    );
    const productId = Number(result.lastInsertRowid);
    if (input.image) {
      db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, 0)')
        .run(productId, input.image);
    }
    return productId;
  });
  const productId = create();
  return mapSellerProduct(db.prepare(`${sellerProductQuery} WHERE p.id = ?`).get(productId));
}

export function updateSellerProduct(productId: number, input: ProductInput, auth) {
  getOwnedProduct(productId, auth);
  if (input.categoryId !== undefined) assertCategoryExists(input.categoryId);

  const columns = {
    name: ['name', input.name],
    generic: ['generic_name', input.generic === undefined ? undefined : input.generic || null],
    description: ['description', input.description === undefined ? undefined : input.description || null],
    categoryId: ['category_id', input.categoryId],
    price: ['price', input.price === undefined ? undefined : Math.round(input.price * 100)],
    stock: ['stock_qty', input.stock],
    lowStockThreshold: ['low_stock_threshold', input.lowStockThreshold],
    requiresPrescription: ['requires_prescription', input.requiresPrescription === undefined ? undefined : Number(input.requiresPrescription)],
    isAvailable: ['is_active', input.isAvailable === undefined ? undefined : Number(input.isAvailable)],
  };
  const updates = Object.values(columns).filter(([, value]) => value !== undefined);

  const update = db.transaction(() => {
    if (updates.length) {
      db.prepare(`UPDATE products SET ${updates.map(([column]) => `${column} = ?`).join(', ')} WHERE id = ?`)
        .run(...updates.map(([, value]) => value), productId);
    }
    if (input.image !== undefined) {
      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(productId);
      if (input.image) {
        db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, 0)')
          .run(productId, input.image);
      }
    }
  });
  update();
  return mapSellerProduct(db.prepare(`${sellerProductQuery} WHERE p.id = ?`).get(productId));
}

export function deleteSellerProduct(productId: number, auth) {
  getOwnedProduct(productId, auth);
  const ordered = db.prepare('SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1').get(productId);
  if (ordered) {
    throw new AppError(409, 'This product has order history and cannot be deleted. Hide it from the catalogue instead.');
  }
  const remove = db.transaction(() => {
    db.prepare('DELETE FROM cart_items WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  });
  remove();
}

function monthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}

export function getSellerDashboard(sellerId: number | null) {
  const scope = sellerId ? 'o.seller_id = ?' : '1 = 1';
  const parameters = sellerId ? [sellerId] : [];

  const orderStats = db.prepare(`
    SELECT COUNT(*) AS total_orders,
           SUM(CASE WHEN o.status IN ${OPEN_STATUSES} THEN 1 ELSE 0 END) AS open_orders,
           SUM(CASE WHEN o.status = 'placed' THEN 1 ELSE 0 END) AS new_orders,
           SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
           SUM(CASE WHEN o.status IN ${CLOSED_STATUSES} THEN 1 ELSE 0 END) AS rejected_orders,
           COALESCE(SUM(CASE WHEN pay.status = 'success' THEN o.total_amt ELSE 0 END), 0) AS earned,
           COALESCE(SUM(CASE WHEN pay.status IS NOT 'success' AND o.status NOT IN ${CLOSED_STATUSES}
                             THEN o.total_amt ELSE 0 END), 0) AS pending_earnings
    FROM orders o LEFT JOIN payments pay ON pay.order_id = o.id
    WHERE ${scope}
  `).get(...parameters);

  const awaitingPrescription = db.prepare(`
    SELECT COUNT(*) AS count FROM order_prescriptions op JOIN orders o ON o.id = op.order_id
    WHERE ${scope} AND op.status = 'pending' AND o.status = 'placed'
  `).get(...parameters).count;

  const productScope = sellerId ? 'p.seller_id = ?' : '1 = 1';
  const productStats = db.prepare(`
    SELECT COUNT(*) AS total_products,
           SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) AS active_products,
           SUM(CASE WHEN p.is_active = 1 AND p.stock_qty <= p.low_stock_threshold THEN 1 ELSE 0 END) AS low_stock,
           COALESCE(SUM(p.stock_qty), 0) AS units_in_stock
    FROM products p WHERE ${productScope}
  `).get(...parameters);

  const lowStock = db.prepare(`
    ${sellerProductQuery}
    WHERE ${productScope} AND p.is_active = 1 AND p.stock_qty <= p.low_stock_threshold
    ORDER BY p.stock_qty, p.name LIMIT 8
  `).all(...parameters).map(mapSellerProduct);

  const topProducts = db.prepare(`
    SELECT p.id, p.name, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE ${scope} AND o.status NOT IN ${CLOSED_STATUSES}
    GROUP BY p.id ORDER BY units DESC, revenue DESC LIMIT 5
  `).all(...parameters).map((row) => ({
    id: publicProductId(row.id),
    name: row.name,
    units: row.units,
    revenue: row.revenue / 100,
  }));

  const months = monthKeys(6);
  const salesByMonth = new Map<string, { sales: number; orders: number }>(db.prepare(`
    SELECT strftime('%Y-%m', o.placed_at) AS month, SUM(o.total_amt) AS sales, COUNT(*) AS orders
    FROM orders o
    WHERE ${scope} AND o.status NOT IN ${CLOSED_STATUSES} AND o.placed_at >= ?
    GROUP BY month
  `).all(...parameters, `${months[0]}-01`).map((row) => [row.month, row]));

  const recentOrders = db.prepare(`
    SELECT o.id FROM orders o WHERE ${scope} ORDER BY o.placed_at DESC, o.id DESC LIMIT 6
  `).all(...parameters).map(({ id }) => getOrderView(id));

  return {
    sellerId: sellerId ? publicSellerId(sellerId) : null,
    metrics: {
      totalOrders: orderStats.total_orders,
      openOrders: orderStats.open_orders || 0,
      newOrders: orderStats.new_orders || 0,
      deliveredOrders: orderStats.delivered_orders || 0,
      rejectedOrders: orderStats.rejected_orders || 0,
      awaitingPrescription,
      earnings: orderStats.earned / 100,
      pendingEarnings: orderStats.pending_earnings / 100,
      totalProducts: productStats.total_products,
      activeProducts: productStats.active_products || 0,
      lowStockProducts: productStats.low_stock || 0,
      unitsInStock: productStats.units_in_stock,
    },
    monthlySales: months.map((month) => ({
      month,
      sales: (salesByMonth.get(month)?.sales || 0) / 100,
      orders: salesByMonth.get(month)?.orders || 0,
    })),
    lowStock,
    topProducts,
    recentOrders,
  };
}
