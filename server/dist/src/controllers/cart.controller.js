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
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { addCartItem, applyCartCoupon, clearCartItems, getCart, removeCartCoupon, removeCartItem, updateCartItem, } from '../services/cart.js';
import { parseProductId } from '../utils/ids.js';
import { Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';
const addItemSchema = z.object({
    productId: z.string().regex(/^p\d{3,}$/i),
    quantity: z.coerce.number().int().min(1).max(1000).default(1),
});
const quantitySchema = z.object({ quantity: z.coerce.number().int().min(1).max(1000) });
const couponSchema = z.object({ code: z.string().trim().min(1).max(30) });
let CartController = class CartController {
    get(request) {
        return getCart(request.auth.id);
    }
    clear(request) {
        clearCartItems(request.auth.id);
        return getCart(request.auth.id);
    }
    add(request, body) {
        const input = parseInput(addItemSchema, body);
        addCartItem(request.auth.id, parseProductId(input.productId), input.quantity);
        return getCart(request.auth.id);
    }
    update(request, productId, body) {
        const input = parseInput(quantitySchema, body);
        updateCartItem(request.auth.id, parseProductId(productId), input.quantity);
        return getCart(request.auth.id);
    }
    remove(request, productId) {
        removeCartItem(request.auth.id, parseProductId(productId));
        return getCart(request.auth.id);
    }
    applyCoupon(request, body) {
        const input = parseInput(couponSchema, body);
        applyCartCoupon(request.auth.id, input.code);
        return getCart(request.auth.id);
    }
    removeCoupon(request) {
        removeCartCoupon(request.auth.id);
        return getCart(request.auth.id);
    }
};
__decorate([
    Get(),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "get", null);
__decorate([
    Delete(),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "clear", null);
__decorate([
    Post('items'),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "add", null);
__decorate([
    Patch('items/:productId'),
    __param(0, Req()),
    __param(1, Param('productId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "update", null);
__decorate([
    Delete('items/:productId'),
    __param(0, Req()),
    __param(1, Param('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "remove", null);
__decorate([
    Post('coupon'),
    HttpCode(200),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "applyCoupon", null);
__decorate([
    Delete('coupon'),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "removeCoupon", null);
CartController = __decorate([
    Roles('customer'),
    Controller('cart')
], CartController);
export { CartController };
