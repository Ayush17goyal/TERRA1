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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const payment_entity_1 = require("./payment.entity");
const settings_entities_1 = require("../settings/settings.entities");
const crypto = require("crypto");
const PLAN_CREDITS = {
    'Basic Plan': 2000,
    'Pro Plan': 5000,
    'Pro Max Plan': 15000,
    'API Credit': 5000,
};
let PaymentService = PaymentService_1 = class PaymentService {
    constructor(paymentRepo, subscriptionRepo) {
        this.paymentRepo = paymentRepo;
        this.subscriptionRepo = subscriptionRepo;
        this.logger = new common_1.Logger(PaymentService_1.name);
        this.razorpayKeyId = process.env.raz_id || process.env.RAZORPAY_KEY_ID || '';
        this.razorpayKeySecret = process.env.raz_secret || process.env.RAZORPAY_KEY_SECRET || '';
        if (!this.razorpayKeyId) {
            this.logger.warn('Razorpay Key ID is not configured (raz_id / RAZORPAY_KEY_ID)');
        }
        if (!this.razorpayKeySecret) {
            this.logger.warn('Razorpay Key Secret is not configured (raz_secret / RAZORPAY_KEY_SECRET)');
        }
    }
    async createOrder(userId, planId, amount) {
        if (!this.razorpayKeyId || !this.razorpayKeySecret) {
            throw new common_1.InternalServerErrorException('Razorpay credentials not configured on server');
        }
        if (!amount || amount <= 0) {
            throw new common_1.BadRequestException('Invalid amount');
        }
        const amountInPaise = amount * 100;
        const receipt = `rcpt_${userId.slice(-8)}_${Date.now()}`;
        const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
                amount: amountInPaise,
                currency: 'INR',
                receipt,
                notes: {
                    plan_id: planId,
                    user_id: userId,
                    platform: 'LEGATRIXON',
                },
            }),
        });
        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`Razorpay order creation failed: ${errBody}`);
            throw new common_1.InternalServerErrorException('Failed to create Razorpay order');
        }
        const order = await response.json();
        const payment = this.paymentRepo.create({
            userId,
            razorpayOrderId: order.id,
            planId,
            amount,
            currency: 'INR',
            status: 'created',
        });
        await this.paymentRepo.save(payment);
        return {
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: this.razorpayKeyId,
        };
    }
    async verifyPayment(userId, paymentId, orderId, signature, planId) {
        if (!this.razorpayKeySecret) {
            throw new common_1.InternalServerErrorException('Razorpay secret not configured');
        }
        const expectedSignature = crypto
            .createHmac('sha256', this.razorpayKeySecret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
        if (expectedSignature !== signature) {
            this.logger.warn(`Signature mismatch for order ${orderId}`);
            throw new common_1.BadRequestException('Payment signature verification failed');
        }
        const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
        const rzpResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Basic ${auth}` },
        });
        let method = 'unknown';
        let rzpAmount = 0;
        if (rzpResponse.ok) {
            const rzpData = await rzpResponse.json();
            method = rzpData.method || 'unknown';
            rzpAmount = rzpData.amount || 0;
            if (rzpData.status !== 'captured' && rzpData.status !== 'authorized') {
                this.logger.warn(`Payment ${paymentId} status is ${rzpData.status}, not captured`);
            }
        }
        const invoiceNumber = `LGTX-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const existingPayment = await this.paymentRepo.findOne({ where: { razorpayOrderId: orderId } });
        if (existingPayment) {
            existingPayment.razorpayPaymentId = paymentId;
            existingPayment.razorpaySignature = signature;
            existingPayment.status = 'captured';
            existingPayment.method = method;
            existingPayment.invoiceNumber = invoiceNumber;
            await this.paymentRepo.save(existingPayment);
        }
        else {
            const payment = this.paymentRepo.create({
                userId,
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
                planId,
                amount: rzpAmount / 100,
                currency: 'INR',
                status: 'captured',
                method,
                invoiceNumber,
            });
            await this.paymentRepo.save(payment);
        }
        await this.activateSubscription(userId, planId);
        return {
            success: true,
            invoice_number: invoiceNumber,
            payment_id: paymentId,
            order_id: orderId,
        };
    }
    async activateSubscription(userId, planId) {
        const credits = PLAN_CREDITS[planId] || 0;
        const isBooster = planId === 'API Credit';
        let sub = await this.subscriptionRepo.findOne({ where: { userId } });
        if (sub) {
            if (isBooster) {
                sub.aiCreditsLimit = (sub.aiCreditsLimit || 0) + credits;
            }
            else {
                sub.planName = planId;
                sub.status = 'active';
                sub.aiCreditsUsed = 0;
                sub.aiCreditsLimit = credits;
                sub.renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
            await this.subscriptionRepo.save(sub);
        }
        else {
            const newSub = this.subscriptionRepo.create({
                userId,
                planName: isBooster ? 'API Credit' : planId,
                status: 'active',
                aiCreditsUsed: 0,
                aiCreditsLimit: credits,
                renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
            await this.subscriptionRepo.save(newSub);
        }
    }
    async getPaymentHistory(userId) {
        return this.paymentRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(1, (0, typeorm_1.InjectRepository)(settings_entities_1.UserSubscription)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], PaymentService);
//# sourceMappingURL=payment.service.js.map