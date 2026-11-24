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
import { Body, Controller, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { createOrdersFromCart } from '../services/checkout.js';
import { Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';
const checkoutSchema = z.object({
    addressId: z.string().regex(/^addr-\d+$/i),
    paymentMethod: z.enum(['cod', 'mock']),
    prescriptionId: z.string().regex(/^RX-\d+$/i).optional(),
});
let CheckoutController = class CheckoutController {
    create(request, body) {
        const input = parseInput(checkoutSchema, body);
        const result = createOrdersFromCart(request.auth.id, input);
        return {
            orders: result.orders,
            checkoutReference: result.checkoutReference,
            paymentStatus: 'pending',
        };
    }
};
__decorate([
    Post(),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "create", null);
CheckoutController = __decorate([
    Roles('customer'),
    Controller('checkout')
], CheckoutController);
export { CheckoutController };
