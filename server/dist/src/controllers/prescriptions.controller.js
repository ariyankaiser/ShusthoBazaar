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
import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors, } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { getPrescriptionFile, listCustomerPrescriptions, listReviewQueue, reviewOrderPrescription, savePrescription, } from '../services/prescriptions.js';
import { parseOrderId, parsePrescriptionId } from '../utils/ids.js';
import { Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';
const queueSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
});
const reviewSchema = z.object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(500).optional(),
});
let PrescriptionsController = class PrescriptionsController {
    upload(request, file) {
        return { prescription: savePrescription(request.auth.id, file) };
    }
    list(request) {
        return { prescriptions: listCustomerPrescriptions(request.auth.id) };
    }
    queue(request, query) {
        const input = parseInput(queueSchema, query);
        return listReviewQueue(request.auth, input.status);
    }
    review(request, orderId, body) {
        const input = parseInput(reviewSchema, body);
        return { order: reviewOrderPrescription(parseOrderId(orderId), input.decision, input.reason, request.auth) };
    }
    file(request, id, response) {
        const file = getPrescriptionFile(parsePrescriptionId(id), request.auth);
        response.setHeader('Content-Type', file.fileType);
        response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Cache-Control', 'private, no-store');
        response.sendFile(file.filePath);
    }
};
__decorate([
    Post(),
    Roles('customer'),
    UseInterceptors(FileInterceptor('file', {
        // One extra byte lets the service report an oversized file with a clear message.
        limits: { fileSize: config.maxPrescriptionBytes + 1, files: 1 },
    })),
    __param(0, Req()),
    __param(1, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionsController.prototype, "upload", null);
__decorate([
    Get(),
    Roles('customer'),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PrescriptionsController.prototype, "list", null);
__decorate([
    Get('reviews'),
    Roles('seller', 'admin'),
    __param(0, Req()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionsController.prototype, "queue", null);
__decorate([
    Patch('reviews/:orderId'),
    Roles('seller', 'admin'),
    __param(0, Req()),
    __param(1, Param('orderId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionsController.prototype, "review", null);
__decorate([
    Get(':id/file'),
    __param(0, Req()),
    __param(1, Param('id')),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionsController.prototype, "file", null);
PrescriptionsController = __decorate([
    Roles('customer', 'seller', 'admin'),
    Controller('prescriptions')
], PrescriptionsController);
export { PrescriptionsController };
