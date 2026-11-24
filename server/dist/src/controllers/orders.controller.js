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
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { advanceOrderStatus, getAuthorizedInvoice, getAuthorizedOrder, listOrders, rejectOrder, } from '../services/orderOperations.js';
import { resubmitOrderPrescription } from '../services/prescriptions.js';
import { parseOrderId, parsePrescriptionId } from '../utils/ids.js';
import { Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';
const statusSchema = z.object({
    status: z.enum(['confirmed', 'out_for_delivery', 'delivered']),
});
const rejectSchema = z.object({
    reason: z.string().trim().min(3).max(500),
});
const prescriptionSchema = z.object({
    prescriptionId: z.string().regex(/^RX-\d+$/i),
});
let OrdersController = class OrdersController {
    list(request) {
        return { orders: listOrders(request.auth) };
    }
    updateStatus(request, id, body) {
        const input = parseInput(statusSchema, body);
        return { order: advanceOrderStatus(parseOrderId(id), input.status, request.auth) };
    }
    reject(request, id, body) {
        const input = parseInput(rejectSchema, body);
        return { order: rejectOrder(parseOrderId(id), input.reason, request.auth) };
    }
    resubmitPrescription(request, id, body) {
        const input = parseInput(prescriptionSchema, body);
        return {
            order: resubmitOrderPrescription(parseOrderId(id), parsePrescriptionId(input.prescriptionId), request.auth.id),
        };
    }
    invoice(request, id) {
        return getAuthorizedInvoice(parseOrderId(id), request.auth);
    }
    detail(request, id) {
        return getAuthorizedOrder(parseOrderId(id), request.auth);
    }
};
__decorate([
    Get(),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "list", null);
__decorate([
    Patch(':id/status'),
    Roles('seller', 'admin'),
    __param(0, Req()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateStatus", null);
__decorate([
    Post(':id/reject'),
    HttpCode(200),
    Roles('seller', 'admin'),
    __param(0, Req()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "reject", null);
__decorate([
    Post(':id/prescription'),
    HttpCode(200),
    Roles('customer'),
    __param(0, Req()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "resubmitPrescription", null);
__decorate([
    Get(':id/invoice'),
    __param(0, Req()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "invoice", null);
__decorate([
    Get(':id'),
    __param(0, Req()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "detail", null);
OrdersController = __decorate([
    Roles('customer', 'seller', 'admin'),
    Controller('orders')
], OrdersController);
export { OrdersController };
