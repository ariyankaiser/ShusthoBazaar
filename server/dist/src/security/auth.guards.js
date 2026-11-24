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
import { Inject, Injectable, SetMetadata, } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { AppError } from '../middleware/errors.js';
const PUBLIC_ROUTE = 'isPublic';
const REQUIRED_ROLES = 'requiredRoles';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Roles = (...roles) => SetMetadata(REQUIRED_ROLES, roles);
const userQuery = db.prepare(`
  SELECT u.id, u.full_name, u.email, u.phone, r.name AS role,
         s.id AS seller_id, s.pharmacy_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN sellers s ON s.user_id = u.id
  WHERE u.id = ? AND u.is_active = 1
`);
function readCookie(request, name) {
    const cookie = request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}
export function publicUser(row) {
    const demoIds = {
        'customer@shusthobazaar.demo': 'demo-customer',
        'seller@shusthobazaar.demo': 'demo-seller',
        'seller2@shusthobazaar.demo': 'demo-seller-2',
        'admin@shusthobazaar.demo': 'demo-admin',
    };
    return {
        id: demoIds[row.email] || `u${row.id}`,
        name: row.full_name,
        email: row.email,
        role: row.role,
        sellerId: row.seller_id ? `s${String(row.seller_id).padStart(3, '0')}` : null,
        storeName: row.pharmacy_name || null,
    };
}
export function issueAuthCookie(response, userId) {
    const token = jwt.sign({}, config.jwtSecret, { subject: String(userId), expiresIn: '7d' });
    response.cookie('sb_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
export function clearAuthCookie(response) {
    response.clearCookie('sb_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}
let AuthGuard = class AuthGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(PUBLIC_ROUTE, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const request = context.switchToHttp().getRequest();
        const authorization = request.headers.authorization;
        const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        const token = bearer || readCookie(request, 'sb_session');
        if (!token)
            throw new AppError(401, 'Authentication required.');
        let claims;
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            if (typeof decoded === 'string' || !decoded.sub)
                throw new Error('Invalid JWT subject');
            claims = decoded;
        }
        catch {
            throw new AppError(401, 'Authentication token is invalid or expired.');
        }
        const row = userQuery.get(Number(claims.sub));
        if (!row)
            throw new AppError(401, 'User account is unavailable.');
        request.auth = {
            id: row.id,
            role: row.role,
            sellerId: row.seller_id,
            user: publicUser(row),
        };
        return true;
    }
};
AuthGuard = __decorate([
    Injectable(),
    __param(0, Inject(Reflector)),
    __metadata("design:paramtypes", [Reflector])
], AuthGuard);
export { AuthGuard };
let RolesGuard = class RolesGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const roles = this.reflector.getAllAndOverride(REQUIRED_ROLES, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!roles?.length)
            return true;
        const request = context.switchToHttp().getRequest();
        if (!request.auth)
            throw new AppError(401, 'Authentication required.');
        if (!roles.includes(request.auth.role)) {
            throw new AppError(403, 'You are not allowed to perform this action.');
        }
        return true;
    }
};
RolesGuard = __decorate([
    Injectable(),
    __param(0, Inject(Reflector)),
    __metadata("design:paramtypes", [Reflector])
], RolesGuard);
export { RolesGuard };
