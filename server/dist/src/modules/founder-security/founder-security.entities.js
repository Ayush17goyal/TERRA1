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
exports.AdminAccountLock = exports.FounderSecurityEvent = exports.FounderSecuritySettings = exports.FOUNDER_SECURITY_EVENTS = exports.FOUNDER_DEFAULT_EMAIL = void 0;
const typeorm_1 = require("typeorm");
exports.FOUNDER_DEFAULT_EMAIL = 'legatrixon2026@gmail.com';
exports.FOUNDER_SECURITY_EVENTS = [
    'ADMIN_LOGIN_ATTEMPT',
    'ADMIN_LOGIN_SUCCESS',
    'ADMIN_LOGIN_FAILED',
    'NEW_DEVICE_LOGIN',
    'NEW_BROWSER_LOGIN',
    'NEW_IP_LOGIN',
    'PASSWORD_CHANGE',
    'NEW_ADMIN_CREATED',
    'ROLE_CHANGED',
    'ACCOUNT_LOCKED',
    'FOUNDER_PORTAL_ACCESS_ATTEMPT',
    'SUPER_ADMIN_ACCESS_ATTEMPT',
];
let FounderSecuritySettings = class FounderSecuritySettings {
};
exports.FounderSecuritySettings = FounderSecuritySettings;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FounderSecuritySettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: exports.FOUNDER_DEFAULT_EMAIL }),
    __metadata("design:type", String)
], FounderSecuritySettings.prototype, "primaryEmail", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], FounderSecuritySettings.prototype, "backupEmails", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], FounderSecuritySettings.prototype, "enabledAlerts", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], FounderSecuritySettings.prototype, "approvalWorkflows", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FounderSecuritySettings.prototype, "updatedAt", void 0);
exports.FounderSecuritySettings = FounderSecuritySettings = __decorate([
    (0, typeorm_1.Entity)('founder_security_settings')
], FounderSecuritySettings);
let FounderSecurityEvent = class FounderSecurityEvent {
};
exports.FounderSecurityEvent = FounderSecurityEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Security event' }),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "actorEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], FounderSecurityEvent.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], FounderSecurityEvent.prototype, "recipients", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "deliveryStatus", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], FounderSecurityEvent.prototype, "deliveryError", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FounderSecurityEvent.prototype, "createdAt", void 0);
exports.FounderSecurityEvent = FounderSecurityEvent = __decorate([
    (0, typeorm_1.Entity)('founder_security_events')
], FounderSecurityEvent);
let AdminAccountLock = class AdminAccountLock {
};
exports.AdminAccountLock = AdminAccountLock;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AdminAccountLock.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AdminAccountLock.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AdminAccountLock.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], AdminAccountLock.prototype, "lockedUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AdminAccountLock.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AdminAccountLock.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AdminAccountLock.prototype, "createdAt", void 0);
exports.AdminAccountLock = AdminAccountLock = __decorate([
    (0, typeorm_1.Entity)('admin_account_locks')
], AdminAccountLock);
//# sourceMappingURL=founder-security.entities.js.map