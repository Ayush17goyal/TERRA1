"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const app_errors_1 = require("./app-errors");
const logger_1 = require("../logging/logger");
const telemetry_1 = require("../observability/telemetry");
let GlobalExceptionFilter = class GlobalExceptionFilter {
    constructor(logger) {
        this.logger = logger;
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const correlationId = request.correlationId;
        const isHttp = exception instanceof common_1.HttpException;
        const isApp = exception instanceof app_errors_1.AppError;
        const status = isApp ? exception.statusCode : isHttp ? exception.getStatus() : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const payload = isHttp ? exception.getResponse() : undefined;
        const defaultMessage = status >= 500 ? 'Something went wrong. Please try again.' : 'The request could not be processed.';
        const message = isApp ? exception.safeMessage : typeof payload === 'object' && payload && 'message' in payload ? payload.message : defaultMessage;
        this.logger.error({ correlationId, status, path: request.path, method: request.method, error: (0, logger_1.errorToLog)(exception) }, 'Request failed');
        if (status >= 500)
            (0, telemetry_1.reportError)(exception, { request: { path: request.path, method: request.method, correlationId } });
        const safeDetails = isHttp && typeof payload === 'object' && payload && status < 500
            ? Object.fromEntries(Object.entries(payload).filter(([key]) => ['code', 'feature', 'mode', 'plan', 'limit', 'used', 'remaining', 'reset', 'timezone', 'action'].includes(key)))
            : {};
        response.status(status).json({ error: isApp ? exception.code : safeDetails.code || (isHttp ? 'REQUEST_FAILED' : 'INTERNAL_ERROR'), message, correlationId, retryable: isApp ? exception.retryable : status >= 500, ...safeDetails });
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [Object])
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map