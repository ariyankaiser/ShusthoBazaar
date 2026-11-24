var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../middleware/errors.js';
import { createSellerProduct, deleteSellerProduct, getSellerDashboard, listSellerProducts, listSellers, resolveSellerScope, updateSellerProduct, } from '../services/sellers.js';
import { parseCategoryId, parseProductId, parseSellerId } from '../utils/ids.js';
import { Roles } from '../security/auth.guards.js';
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
let SellerController = class SellerController {
    stores() {
        return { sellers: listSellers() };
    }
    dashboard(request, query) {
        const input = parseInput(scopeSchema, query);
        const sellerId = resolveSellerScope(request.auth, input.sellerId ? parseSellerId(input.sellerId) : null);
        return getSellerDashboard(sellerId);
    }
    products(request, query) {
        const input = parseInput(scopeSchema, query);
        const sellerId = resolveSellerScope(request.auth, input.sellerId ? parseSellerId(input.sellerId) : null);
        return { products: listSellerProducts(sellerId) };
    }
    create(request, body) {
        const input = parseInput(createSchema, body);
        const sellerId = resolveSellerScope(request.auth, input.sellerId ? parseSellerId(input.sellerId) : null);
        if (!sellerId)
            throw new AppError(422, 'Choose the pharmacy that sells this product.');
        return { product: createSellerProduct(sellerId, toProductInput(input)) };
    }
    update(request, id, body) {
        const input = parseInput(updateSchema, body);
        return { product: updateSellerProduct(parseProductId(id), toProductInput(input), request.auth) };
    }
    remove(request, id) {
        deleteSellerProduct(parseProductId(id), request.auth);
        return { success: true };
    }
};
__decorate([
    Get('stores'),
    Roles('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SellerController.prototype, "stores", null);
__decorate([
    Get('dashboard'),
    __param(0, Req()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SellerController.prototype, "dashboard", null);
__decorate([
    Get('products'),
    __param(0, Req()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SellerController.prototype, "products", null);
__decorate([
    Post('products'),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SellerController.prototype, "create", null);
__decorate([
    Patch('products/:id'),
    __param(0, Req()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SellerController.prototype, "update", null);
__decorate([
    Delete('products/:id'),
    HttpCode(200),
    __param(0, Req()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SellerController.prototype, "remove", null);
SellerController = __decorate([
    Roles('seller', 'admin'),
    Controller('seller')
], SellerController);
export { SellerController };
