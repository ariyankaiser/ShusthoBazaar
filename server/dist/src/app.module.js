var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller.js';
import { CatalogueController } from './controllers/catalogue.controller.js';
import { CartController } from './controllers/cart.controller.js';
import { AddressesController } from './controllers/addresses.controller.js';
import { CheckoutController } from './controllers/checkout.controller.js';
import { OrdersController } from './controllers/orders.controller.js';
import { PaymentsController } from './controllers/payments.controller.js';
import { SellerController } from './controllers/seller.controller.js';
import { PrescriptionsController } from './controllers/prescriptions.controller.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { AdminController } from './controllers/admin.controller.js';
import { AuthGuard, RolesGuard } from './security/auth.guards.js';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        controllers: [
            AuthController,
            CatalogueController,
            CartController,
            AddressesController,
            CheckoutController,
            OrdersController,
            PaymentsController,
            SellerController,
            PrescriptionsController,
            AnalyticsController,
            AdminController,
        ],
        providers: [
            { provide: APP_GUARD, useClass: AuthGuard },
            { provide: APP_GUARD, useClass: RolesGuard },
        ],
    })
], AppModule);
export { AppModule };
