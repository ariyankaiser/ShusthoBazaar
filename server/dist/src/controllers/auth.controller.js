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
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { AppError } from '../middleware/errors.js';
import { clearAuthCookie, issueAuthCookie, publicUser, Public, } from '../security/auth.guards.js';
import { parseInput } from '../common/validation.js';
const registerSchema = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    phone: z.string().trim().min(7).max(20).optional(),
});
const loginSchema = z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(128),
});
const findUser = db.prepare(`
  SELECT u.id, u.full_name, u.email, u.phone, u.password_hash,
         r.name AS role, s.id AS seller_id, s.pharmacy_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN sellers s ON s.user_id = u.id
  WHERE lower(u.email) = lower(?) AND u.is_active = 1
`);
let AuthController = class AuthController {
    register(body, response) {
        const input = parseInput(registerSchema, body);
        const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(input.email);
        if (existing)
            throw new AppError(409, 'An account with that email already exists.');
        try {
            const customerRoleId = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get()?.id;
            if (!customerRoleId)
                throw new Error('Customer role is missing from the database seed.');
            const passwordHash = bcrypt.hashSync(input.password, 12);
            const result = db.prepare('INSERT INTO users (role_id, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)').run(customerRoleId, input.name, input.email, input.phone || null, passwordHash);
            const user = findUser.get(input.email);
            if (!user)
                throw new Error('Registered account could not be loaded.');
            issueAuthCookie(response, Number(result.lastInsertRowid));
            return { user: publicUser(user) };
        }
        catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new AppError(409, 'An account with that email or phone already exists.');
            }
            throw error;
        }
    }
    login(body, response) {
        const input = parseInput(loginSchema, body);
        const row = findUser.get(input.email);
        if (!row || !bcrypt.compareSync(input.password, row.password_hash)) {
            throw new AppError(401, 'Email or password is incorrect.');
        }
        issueAuthCookie(response, row.id);
        return { user: publicUser(row) };
    }
    logout(response) {
        clearAuthCookie(response);
        return { success: true };
    }
    me(request) {
        return { user: request.auth.user };
    }
};
__decorate([
    Public(),
    Post('register'),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    Public(),
    Post('login'),
    HttpCode(200),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    Public(),
    Post('logout'),
    HttpCode(200),
    __param(0, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
__decorate([
    Get('me'),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
AuthController = __decorate([
    Controller('auth')
], AuthController);
export { AuthController };
