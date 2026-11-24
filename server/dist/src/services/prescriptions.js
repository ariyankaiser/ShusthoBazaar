import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { AppError } from '../middleware/errors.js';
import { orderPublicId, publicPrescriptionId } from '../utils/ids.js';
import { displayOrderStatus, displayPrescriptionStatus, getOrderView } from './orders.js';
const prescriptionDirectory = () => path.join(config.uploadDir, 'prescriptions');
const fileTypes = {
    'image/jpeg': { extension: 'jpg', label: 'JPEG image' },
    'image/png': { extension: 'png', label: 'PNG image' },
    'application/pdf': { extension: 'pdf', label: 'PDF document' },
};
// Identify the file from its leading bytes; the browser-supplied MIME type and
// file name are not trusted.
export function detectFileType(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
        return 'image/jpeg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png';
    }
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-')
        return 'application/pdf';
    return null;
}
function cleanFileName(name, extension) {
    const base = path.basename(String(name || ''))
        .replace(/[^\p{L}\p{N} ._()-]/gu, '')
        .trim()
        .slice(0, 120);
    return base || `prescription.${extension}`;
}
function mapPrescription(row) {
    return {
        id: publicPrescriptionId(row.id),
        fileName: row.original_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        uploadedAt: row.uploaded_at,
        fileUrl: `/api/prescriptions/${publicPrescriptionId(row.id)}/file`,
    };
}
export function savePrescription(customerId, file) {
    if (!file?.buffer?.length)
        throw new AppError(400, 'Choose a prescription file to upload.');
    if (file.buffer.length > config.maxPrescriptionBytes) {
        throw new AppError(413, 'Prescription files must be 5 MB or smaller.');
    }
    const fileType = detectFileType(file.buffer);
    if (!fileType)
        throw new AppError(415, 'Upload a JPEG, PNG or PDF prescription.');
    const { extension } = fileTypes[fileType];
    const storedName = `${randomUUID()}.${extension}`;
    fs.mkdirSync(prescriptionDirectory(), { recursive: true });
    const storedPath = path.join(prescriptionDirectory(), storedName);
    fs.writeFileSync(storedPath, file.buffer, { flag: 'wx' });
    try {
        const result = db.prepare(`
      INSERT INTO prescriptions (customer_id, stored_name, original_name, file_type, file_size)
      VALUES (?, ?, ?, ?, ?)
    `).run(customerId, storedName, cleanFileName(file.originalname, extension), fileType, file.buffer.length);
        const row = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(Number(result.lastInsertRowid));
        return mapPrescription(row);
    }
    catch (error) {
        fs.rmSync(storedPath, { force: true });
        throw error;
    }
}
export function assertCustomerPrescription(prescriptionId, customerId) {
    const row = db.prepare('SELECT id FROM prescriptions WHERE id = ? AND customer_id = ?').get(prescriptionId, customerId);
    if (!row)
        throw new AppError(404, 'Prescription not found.');
    return row;
}
export function listCustomerPrescriptions(customerId) {
    const rows = db.prepare('SELECT * FROM prescriptions WHERE customer_id = ? ORDER BY uploaded_at DESC, id DESC')
        .all(customerId);
    const links = db.prepare(`
    SELECT op.order_id, op.status, op.rejection_reason, s.pharmacy_name
    FROM order_prescriptions op
    JOIN orders o ON o.id = op.order_id
    JOIN sellers s ON s.id = o.seller_id
    WHERE op.prescription_id = ?
    ORDER BY op.order_id
  `);
    return rows.map((row) => ({
        ...mapPrescription(row),
        reviews: links.all(row.id).map((link) => ({
            orderId: orderPublicId(link.order_id),
            sellerName: link.pharmacy_name,
            status: link.status,
            statusLabel: displayPrescriptionStatus(link.status),
            rejectionReason: link.rejection_reason,
        })),
    }));
}
export function getPrescriptionFile(prescriptionId, auth) {
    const row = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(prescriptionId);
    if (!row)
        throw new AppError(404, 'Prescription not found.');
    let allowed = auth.role === 'admin' || (auth.role === 'customer' && row.customer_id === auth.id);
    if (!allowed && auth.role === 'seller') {
        allowed = Boolean(db.prepare(`
      SELECT 1 FROM order_prescriptions op JOIN orders o ON o.id = op.order_id
      WHERE op.prescription_id = ? AND o.seller_id = ? LIMIT 1
    `).get(prescriptionId, auth.sellerId));
    }
    if (!allowed)
        throw new AppError(404, 'Prescription not found.');
    const filePath = path.join(prescriptionDirectory(), path.basename(row.stored_name));
    if (!fs.existsSync(filePath))
        throw new AppError(404, 'Prescription file is missing.');
    return { filePath, fileType: row.file_type, fileName: row.original_name };
}
export function listReviewQueue(auth, status) {
    const clauses = [];
    const parameters = [];
    if (auth.role === 'seller') {
        clauses.push('o.seller_id = ?');
        parameters.push(auth.sellerId);
    }
    if (status) {
        clauses.push('op.status = ?');
        parameters.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`
    SELECT op.order_id, op.status, op.rejection_reason, op.reviewed_at, op.submitted_at,
           o.status AS order_status, o.placed_at,
           u.full_name AS customer_name, s.pharmacy_name, reviewer.full_name AS reviewer_name,
           pr.id AS prescription_id, pr.original_name, pr.file_type, pr.file_size, pr.uploaded_at
    FROM order_prescriptions op
    JOIN orders o ON o.id = op.order_id
    JOIN users u ON u.id = o.customer_id
    JOIN sellers s ON s.id = o.seller_id
    JOIN prescriptions pr ON pr.id = op.prescription_id
    LEFT JOIN users reviewer ON reviewer.id = op.reviewed_by
    ${where}
    ORDER BY CASE op.status WHEN 'pending' THEN 0 ELSE 1 END, op.submitted_at DESC, op.order_id DESC
  `).all(...parameters);
    const rxItems = db.prepare(`
    SELECT p.name, oi.quantity FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ? AND p.requires_prescription = 1 ORDER BY oi.id
  `);
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const row of db.prepare(`
    SELECT op.status, COUNT(*) AS count FROM order_prescriptions op JOIN orders o ON o.id = op.order_id
    ${auth.role === 'seller' ? 'WHERE o.seller_id = ?' : ''}
    GROUP BY op.status
  `).all(...(auth.role === 'seller' ? [auth.sellerId] : []))) {
        counts[row.status] = row.count;
    }
    return {
        counts,
        reviews: rows.map((row) => ({
            orderId: orderPublicId(row.order_id),
            orderStatus: displayOrderStatus(row.order_status),
            placedAt: row.placed_at,
            customer: row.customer_name,
            sellerName: row.pharmacy_name,
            status: row.status,
            statusLabel: displayPrescriptionStatus(row.status),
            rejectionReason: row.rejection_reason,
            reviewedAt: row.reviewed_at,
            reviewedBy: row.reviewer_name,
            submittedAt: row.submitted_at,
            canReview: row.status === 'pending' && row.order_status === 'placed',
            items: rxItems.all(row.order_id),
            prescription: mapPrescription({
                id: row.prescription_id,
                original_name: row.original_name,
                file_type: row.file_type,
                file_size: row.file_size,
                uploaded_at: row.uploaded_at,
            }),
        })),
    };
}
export function reviewOrderPrescription(orderId, decision, reason, auth) {
    const transaction = db.transaction(() => {
        const row = db.prepare(`
      SELECT op.status, o.seller_id, o.status AS order_status
      FROM order_prescriptions op JOIN orders o ON o.id = op.order_id
      WHERE op.order_id = ?
    `).get(orderId);
        if (!row || (auth.role === 'seller' && row.seller_id !== auth.sellerId)) {
            throw new AppError(404, 'Prescription review not found.');
        }
        if (row.order_status !== 'placed') {
            throw new AppError(409, 'Prescriptions can only be reviewed while the order is awaiting confirmation.');
        }
        if (row.status !== 'pending')
            throw new AppError(409, `This prescription is already ${row.status}.`);
        if (decision === 'rejected' && !reason?.trim()) {
            throw new AppError(422, 'Give the customer a reason for rejecting the prescription.');
        }
        db.prepare(`
      UPDATE order_prescriptions
      SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).run(decision, decision === 'rejected' ? reason.trim() : null, auth.id, orderId);
    });
    transaction();
    return getOrderView(orderId);
}
// After a rejection the customer can attach a different prescription and send it
// back to the same pharmacy for another review.
export function resubmitOrderPrescription(orderId, prescriptionId, customerId) {
    const transaction = db.transaction(() => {
        const row = db.prepare(`
      SELECT o.customer_id, o.status AS order_status, op.status
      FROM orders o LEFT JOIN order_prescriptions op ON op.order_id = o.id
      WHERE o.id = ?
    `).get(orderId);
        if (!row || row.customer_id !== customerId)
            throw new AppError(404, 'Order not found.');
        if (!row.status)
            throw new AppError(409, 'This order does not need a prescription.');
        if (row.order_status !== 'placed')
            throw new AppError(409, 'This order can no longer be changed.');
        if (row.status !== 'rejected') {
            throw new AppError(409, 'A new prescription can only be sent after the pharmacy rejects the current one.');
        }
        assertCustomerPrescription(prescriptionId, customerId);
        db.prepare(`
      UPDATE order_prescriptions
      SET prescription_id = ?, status = 'pending', rejection_reason = NULL,
          reviewed_by = NULL, reviewed_at = NULL, submitted_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).run(prescriptionId, orderId);
    });
    transaction();
    return getOrderView(orderId);
}
