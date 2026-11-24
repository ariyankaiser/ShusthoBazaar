import { AppError } from '../middleware/errors.js';

function parsePrefixedId(value, prefix, field) {
  const match = new RegExp(`^${prefix}(\\d+)$`, 'i').exec(String(value));
  if (!match) throw new AppError(400, `Invalid ${field}.`);
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, `Invalid ${field}.`);
  return id;
}

export const parseProductId = (value) => parsePrefixedId(value, 'p', 'product ID');
export const parseAddressId = (value) => parsePrefixedId(value, 'addr-', 'address ID');

export function orderPublicId(id) {
  return `SB-${String(id).padStart(6, '0')}`;
}

export function parseOrderId(value) {
  const match = /^SB-(\d+)$/i.exec(String(value));
  if (!match) throw new AppError(400, 'Invalid order ID.');
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid order ID.');
  return id;
}

export function publicProductId(id) {
  return `p${String(id).padStart(3, '0')}`;
}

export function publicAddressId(id) {
  return `addr-${id}`;
}

export const parseSellerId = (value) => parsePrefixedId(value, 's', 'seller ID');
export const parseCategoryId = (value) => parsePrefixedId(value, 'c', 'category ID');

export function publicSellerId(id) {
  return `s${String(id).padStart(3, '0')}`;
}

export function publicPrescriptionId(id) {
  return `RX-${String(id).padStart(6, '0')}`;
}

export function parsePrescriptionId(value) {
  const match = /^RX-(\d+)$/i.exec(String(value));
  if (!match) throw new AppError(400, 'Invalid prescription ID.');
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid prescription ID.');
  return id;
}
