import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { PaymentService } from './payment.service';

@Controller('payment')
@UseGuards(ClerkAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /api/v1/payment/create-order
   * Creates a Razorpay order for the authenticated user.
   */
  @Post('create-order')
  async createOrder(@Req() req: any, @Body() body: { plan_id: string; amount: number }) {
    const userId = req.user.id;
    return this.paymentService.createOrder(userId, body.plan_id, body.amount);
  }

  /**
   * POST /api/v1/payment/verify-payment
   * Verifies the Razorpay payment signature and activates the subscription.
   */
  @Post('verify-payment')
  async verifyPayment(
    @Req() req: any,
    @Body() body: {
      payment_id: string;
      order_id: string;
      signature: string;
      plan_id: string;
    },
  ) {
    const userId = req.user.id;
    return this.paymentService.verifyPayment(
      userId,
      body.payment_id,
      body.order_id,
      body.signature,
      body.plan_id,
    );
  }

  /**
   * GET /api/v1/payment/history
   * Returns the payment history for the authenticated user.
   */
  @Get('history')
  async getHistory(@Req() req: any) {
    const userId = req.user.id;
    return this.paymentService.getPaymentHistory(userId);
  }
}
