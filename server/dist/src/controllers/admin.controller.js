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
import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';
import { createCouponAdmin, listAllDoctorsAdmin, listAllSellersAdmin, listAllUsers, listComplaintsAdmin, listCouponsAdmin, listReviewsAdmin, resolveComplaintAdmin, setUserActiveStatus, toggleCouponAdmin, toggleReviewVisibilityAdmin, verifyDoctorAccount, verifySellerAccount, } from '../services/admin.service.js';
const verifySchema = z.object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(500).optional(),
});
const couponSchema = z.object({
    code: z.string().trim().min(3).max(30),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.coerce.number().positive(),
    minOrderAmt: z.coerce.number().min(0),
    validTo: z.string().min(4),
});
let AdminController = class AdminController {
    users() {
        return { users: listAllUsers() };
    }
    toggleUser(id, isActive) {
        return setUserActiveStatus(Number(id), Boolean(isActive));
    }
    sellers() {
        return { sellers: listAllSellersAdmin() };
    }
    verifySeller(req, id, body) {
        const input = parseInput(verifySchema, body);
        const adminId = req.auth?.id ?? req.auth?.userId ?? null;
        return verifySellerAccount(Number(id), adminId, input.status, input.reason);
    }
    doctors() {
        return { doctors: listAllDoctorsAdmin() };
    }
    verifyDoctor(id, body) {
        const input = parseInput(verifySchema, body);
        return verifyDoctorAccount(Number(id), input.status, input.reason);
    }
    coupons() {
        return { coupons: listCouponsAdmin() };
    }
    createCoupon(body) {
        const input = parseInput(couponSchema, body);
        return createCouponAdmin(input);
    }
    toggleCoupon(id, isActive) {
        return toggleCouponAdmin(Number(id), Boolean(isActive));
    }
    reviews() {
        return { reviews: listReviewsAdmin() };
    }
    toggleReview(id, isVisible) {
        return toggleReviewVisibilityAdmin(Number(id), Boolean(isVisible));
    }
    complaints() {
        return { complaints: listComplaintsAdmin() };
    }
    resolveComplaint(id, actionTaken) {
        return resolveComplaintAdmin(Number(id), actionTaken || 'Resolved by administrator');
    }
};
__decorate([
    Get('users'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "users", null);
__decorate([
    Patch('users/:id/status'),
    __param(0, Param('id')),
    __param(1, Body('isActive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "toggleUser", null);
__decorate([
    Get('sellers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "sellers", null);
__decorate([
    Patch('sellers/:id/verify'),
    __param(0, Req()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "verifySeller", null);
__decorate([
    Get('doctors'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "doctors", null);
__decorate([
    Patch('doctors/:id/verify'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "verifyDoctor", null);
__decorate([
    Get('coupons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "coupons", null);
__decorate([
    Post('coupons'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createCoupon", null);
__decorate([
    Patch('coupons/:id/status'),
    __param(0, Param('id')),
    __param(1, Body('isActive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "toggleCoupon", null);
__decorate([
    Get('reviews'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "reviews", null);
__decorate([
    Patch('reviews/:id/visibility'),
    __param(0, Param('id')),
    __param(1, Body('isVisible')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "toggleReview", null);
__decorate([
    Get('complaints'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "complaints", null);
__decorate([
    Patch('complaints/:id/resolve'),
    __param(0, Param('id')),
    __param(1, Body('actionTaken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolveComplaint", null);
AdminController = __decorate([
    Roles('admin'),
    Controller('admin')
], AdminController);
export { AdminController };
