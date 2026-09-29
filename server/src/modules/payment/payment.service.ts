import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { UserSubscription } from '../settings/settings.entities';
import * as crypto from 'crypto';

// Plan credit mapping
const PLAN_CREDITS: Record<string, number> = {
  'Basic Plan': 2000,
  'Pro Plan': 5000,
  'Pro Max Plan': 15000,
  'API Credit': 5000, // stackable booster
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly razorpayKeyId: string;
  private readonly razorpayKeySecret: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(UserSubscription)
    private readonly subscriptionRepo: Repository<UserSubscription>,
  ) {
    this.razorpayKeyId = process.env.raz_id || process.env.RAZORPAY_KEY_ID || '';
    this.razorpayKeySecret = process.env.raz_secret || process.env.RAZORPAY_KEY_SECRET || '';

    if (!this.razorpayKeyId) {
      this.logger.warn('Razorpay Key ID is not configured (raz_id / RAZORPAY_KEY_ID)');
    }
    if (!this.razorpayKeySecret) {
      this.logger.warn('Razorpay Key Secret is not configured (raz_secret / RAZORPAY_KEY_SECRET)');
    }
  }

  /**
   * Creates a Razorpay order via their REST API.
   */
  async createOrder(userId: string, planId: string, amount: number) {
    if (!this.razorpayKeyId || !this.razorpayKeySecret) {
      throw new InternalServerErrorException('Razorpay credentials not configured on server');
    }

    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const amountInPaise = amount * 100;
    const receipt = `rcpt_${userId.slice(-8)}_${Date.now()}`;

    // Call Razorpay Orders API
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
      throw new InternalServerErrorException('Failed to create Razorpay order');
    }

    const order = await response.json();

    // Save initial payment record
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

  /**
   * Verifies Razorpay payment signature and activates subscription.
   */
  async verifyPayment(
    userId: string,
    paymentId: string,
    orderId: string,
    signature: string,
    planId: string,
  ) {
    if (!this.razorpayKeySecret) {
      throw new InternalServerErrorException('Razorpay secret not configured');
    }

    // 1. Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', this.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      this.logger.warn(`Signature mismatch for order ${orderId}`);
      throw new BadRequestException('Payment signature verification failed');
    }

    // 2. Fetch payment details from Razorpay to confirm
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

    // 3. Generate invoice number
    const invoiceNumber = `LGTX-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 4. Update payment record
    const existingPayment = await this.paymentRepo.findOne({ where: { razorpayOrderId: orderId } });
    if (existingPayment) {
      existingPayment.razorpayPaymentId = paymentId;
      existingPayment.razorpaySignature = signature;
      existingPayment.status = 'captured';
      existingPayment.method = method;
      existingPayment.invoiceNumber = invoiceNumber;
      await this.paymentRepo.save(existingPayment);
    } else {
      // Create new record if order wasn't tracked
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

    // 5. Activate subscription in user_subscriptions
    await this.activateSubscription(userId, planId);

    return {
      success: true,
      invoice_number: invoiceNumber,
      payment_id: paymentId,
      order_id: orderId,
    };
  }

  /**
   * Activates or upgrades the user's subscription and resets/stacks credits.
   */
  private async activateSubscription(userId: string, planId: string) {
    const credits = PLAN_CREDITS[planId] || 0;
    const isBooster = planId === 'API Credit';

    let sub = await this.subscriptionRepo.findOne({ where: { userId } });

    if (sub) {
      if (isBooster) {
        // Stack credits for API Credit booster
        sub.aiCreditsLimit = (sub.aiCreditsLimit || 0) + credits;
      } else {
        // Full plan upgrade: reset credits
        sub.planName = planId;
        sub.status = 'active';
        sub.aiCreditsUsed = 0;
        sub.aiCreditsLimit = credits;
        sub.renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }
      await this.subscriptionRepo.save(sub);
    } else {
      // Create new subscription
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

  /**
   * Returns payment history for a user.
   */
  async getPaymentHistory(userId: string) {
    return this.paymentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
