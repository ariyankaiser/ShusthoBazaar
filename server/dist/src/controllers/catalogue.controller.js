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
import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../middleware/errors.js';
import { getProduct, listCategories, listProducts } from '../services/catalogue.js';
import { parseProductId } from '../utils/ids.js';
import { parseInput } from '../common/validation.js';
import { Public } from '../security/auth.guards.js';
const querySchema = z.object({
    q: z.string().trim().max(120).optional().default(''),
    category: z.string().trim().max(100).optional().default(''),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(100),
});
let CatalogueController = class CatalogueController {
    health() {
        return { status: 'ok' };
    }
    categories() {
        return { categories: listCategories() };
    }
    products(query) {
        const input = parseInput(querySchema, query);
        const result = listProducts(input);
        return {
            products: result.products,
            page: input.page,
            limit: input.limit,
            total: result.total,
        };
    }
    product(rawId) {
        const product = getProduct(parseProductId(rawId));
        if (!product)
            throw new AppError(404, 'Product not found.');
        return product;
    }
};
__decorate([
    Get('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogueController.prototype, "health", null);
__decorate([
    Get('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogueController.prototype, "categories", null);
__decorate([
    Get('products'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogueController.prototype, "products", null);
__decorate([
    Get('products/:id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogueController.prototype, "product", null);
CatalogueController = __decorate([
    Public(),
    Controller()
], CatalogueController);
export { CatalogueController };
