var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Catch, HttpException, HttpStatus, } from '@nestjs/common';
let HttpErrorFilter = class HttpErrorFilter {
    catch(error, host) {
        const context = host.switchToHttp();
        const request = context.getRequest();
        const response = context.getResponse();
        const appError = error;
        if (appError?.name === 'ZodError') {
            return response.status(400).json({
                error: 'Request validation failed.',
                details: appError.issues?.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            });
        }
        if (error instanceof HttpException) {
            const status = error.getStatus();
            const payload = error.getResponse();
            if (typeof payload === 'object' && payload !== null && 'error' in payload) {
                return response.status(status).json(payload);
            }
            const message = typeof payload === 'string'
                ? payload
                : payload.message;
            return response.status(status).json({
                error: status >= 500 ? 'Internal server error.' : Array.isArray(message) ? message[0] : message || error.message,
            });
        }
        const status = Number.isInteger(appError?.status) ? appError.status : HttpStatus.INTERNAL_SERVER_ERROR;
        if (status >= 500)
            console.error(error);
        return response.status(status).json({
            error: status >= 500
                ? 'Internal server error.'
                : appError.message || `Route not found: ${request.method} ${request.path}`,
            ...(appError.details ? { details: appError.details } : {}),
        });
    }
};
HttpErrorFilter = __decorate([
    Catch()
], HttpErrorFilter);
export { HttpErrorFilter };
