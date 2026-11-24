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
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { publicAddressId } from '../utils/ids.js';
import { Roles } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';
const addressSchema = z.object({
    label: z.string().trim().max(40).optional().default('Home'),
    recipient: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
    street: z.string().trim().min(3).max(1000),
    area: z.string().trim().max(80).optional().default(''),
    city: z.string().trim().min(2).max(80),
    postalCode: z.string().trim().max(20).optional().default(''),
    latitude: z.coerce.number().min(-90).max(90).optional().default(23.8103),
    longitude: z.coerce.number().min(-180).max(180).optional().default(90.4125),
});
function listAddresses(userId) {
    return db.prepare(`
    SELECT id, label, recipient, phone, postal_code, address_line, area,
           city, latitude, longitude, is_default
    FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC
  `).all(userId).map((row) => ({
        id: publicAddressId(row.id),
        label: row.label || 'Address',
        recipient: row.recipient,
        phone: row.phone,
        street: row.address_line,
        area: row.area || '',
        city: row.city,
        postalCode: row.postal_code || '',
        latitude: row.latitude,
        longitude: row.longitude,
        isDefault: Boolean(row.is_default),
    }));
}
let AddressesController = class AddressesController {
    list(request) {
        return { addresses: listAddresses(request.auth.id) };
    }
    create(request, body) {
        const address = parseInput(addressSchema, body);
        const userId = request.auth.id;
        const count = db.prepare('SELECT COUNT(*) AS count FROM addresses WHERE user_id = ?').get(userId);
        const isDefault = count.count === 0;
        const insert = db.transaction(() => {
            if (isDefault)
                db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
            db.prepare(`
        INSERT INTO addresses
          (user_id, label, recipient, phone, postal_code, address_line, area, city, latitude, longitude, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, address.label, address.recipient, address.phone, address.postalCode, address.street, address.area, address.city, address.latitude, address.longitude, isDefault ? 1 : 0);
        });
        insert();
        return { addresses: listAddresses(userId) };
    }
};
__decorate([
    Get(),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AddressesController.prototype, "list", null);
__decorate([
    Post(),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AddressesController.prototype, "create", null);
AddressesController = __decorate([
    Roles('customer'),
    Controller('addresses')
], AddressesController);
export { AddressesController };
