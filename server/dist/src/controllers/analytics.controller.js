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
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../security/auth.guards.js';
import { resolveSellerScope } from '../services/sellers.js';
import { parseSellerId } from '../utils/ids.js';
import { parseInput } from '../common/validation.js';
import { generateAnalyticsCsv, getAnalyticsOverview } from '../services/analytics.service.js';
const scopeSchema = z.object({
    sellerId: z.string().regex(/^s\d+$/i).optional(),
});
let AnalyticsController = class AnalyticsController {
    overview(request, query) {
        const input = parseInput(scopeSchema, query);
        const sellerId = resolveSellerScope(request.auth, input.sellerId ? parseSellerId(input.sellerId) : null);
        return getAnalyticsOverview(sellerId);
    }
    exportCsv(request, query, res) {
        const input = parseInput(scopeSchema, query);
        const sellerId = resolveSellerScope(request.auth, input.sellerId ? parseSellerId(input.sellerId) : null);
        const csv = generateAnalyticsCsv(sellerId);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="shusthobazaar-analytics.csv"');
        res.send(csv);
    }
};
__decorate([
    Get('overview'),
    __param(0, Req()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "overview", null);
__decorate([
    Get('export/csv'),
    __param(0, Req()),
    __param(1, Query()),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "exportCsv", null);
AnalyticsController = __decorate([
    Roles('seller', 'admin'),
    Controller('analytics')
], AnalyticsController);
export { AnalyticsController };
