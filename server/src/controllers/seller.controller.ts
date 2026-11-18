import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../middleware/errors.js';
import {
  createSellerProduct,
  deleteSellerProduct,
  getSellerDashboard,
  listSellerProducts,
  listSellers,
  resolveSellerScope,
  updateSellerProduct,
} from '../services/sellers.js';
import { parseCategoryId, parseProductId, parseSellerId } from '../utils/ids.js';
import { AuthenticatedRequest, Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';

const scopeSchema = z.object({
  sellerId: z.string().regex(/^s\d+$/i).optional(),
});

const productFields = {
  name: z.string().trim().min(2).max(200),
  generic: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().regex(/^c\d+$/i),
  price: z.coerce.number().positive().max(1_000_000)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Use at most two decimal places.'),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000).optional(),
  requiresPrescription: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  image: z.union([
    z.literal(''),
    z.string().trim().max(500).regex(/^(\/images\/[\w.-]+|https:\/\/\S+)$/, 'Use a /images/... path or an https URL.'),
  ]).optional(),
};
const createSchema = z.object({ ...productFields, sellerId: z.string().regex(/^s\d+$/i).optional() });
const updateSchema = z.object(productFields).partial();

function toProductInput(input) {
  return {
    ...input,
    categoryId: input.categoryId === undefined ? undefined : parseCategoryId(input.categoryId),
  };
}

@Roles('seller', 'admin')
@Controller('seller')
export class SellerController {
  @Get('stores')
  @Roles('admin')
  stores() {
    return { sellers: listSellers() };
  }

  @Get('dashboard')
  dashboard(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const input = parseInput(scopeSchema, query);
    const sellerId = resolveSellerScope(request.auth!, input.sellerId ? parseSellerId(input.sellerId) : null);
    return getSellerDashboard(sellerId);
  }

  @Get('products')
  products(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const input = parseInput(scopeSchema, query);
    const sellerId = resolveSellerScope(request.auth!, input.sellerId ? parseSellerId(input.sellerId) : null);
    return { products: listSellerProducts(sellerId) };
  }

  @Post('products')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseInput(createSchema, body);
    const sellerId = resolveSellerScope(request.auth!, input.sellerId ? parseSellerId(input.sellerId) : null);
    if (!sellerId) throw new AppError(422, 'Choose the pharmacy that sells this product.');
    return { product: createSellerProduct(sellerId, toProductInput(input)) };
  }

  @Patch('products/:id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parseInput(updateSchema, body);
    return { product: updateSellerProduct(parseProductId(id), toProductInput(input), request.auth!) };
  }

  @Delete('products/:id')
  @HttpCode(200)
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    deleteSellerProduct(parseProductId(id), request.auth!);
    return { success: true };
  }
}
