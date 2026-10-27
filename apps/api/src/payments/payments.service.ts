import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentWebhookDto, SimulatePaymentDto } from './dto/payment-webhook.dto';
import { PaymentStatus, PaymentType } from '@prisma/client';

export function computePaymentSignature(
  transactionRef: string,
  amountVnd: number | bigint,
  status: string,
  secretKey?: string,
): string {
  const secret =
    secretKey || process.env.PAYMENT_GATEWAY_SECRET || 'carsharing_sandbox_secret_key_2026';
  const rawPayload = `${transactionRef}|${Number(amountVnd)}|${status}`;
  return createHmac('sha512', secret).update(rawPayload).digest('hex');
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPaymentIntent(
    actorId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        pricingSnapshot: true,
        vehicle: true,
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy đơn đặt xe để thanh toán',
      });
    }

    if (booking.renterId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ khách thuê của đơn này mới có quyền tạo giao dịch thanh toán',
      });
    }

    if (booking.status !== 'REQUESTED' && booking.status !== 'APPROVED') {
      throw new ConflictException({
        code: 'INVALID_BOOKING_STATUS',
        message: `Đơn thuê đang ở trạng thái ${booking.status}, không thể thực hiện thanh toán`,
      });
    }

    if (!booking.pricingSnapshot) {
      throw new ConflictException({
        code: 'SNAPSHOT_MISSING',
        message: 'Không tìm thấy thông tin biểu phí của đơn thuê',
      });
    }

    // Determine amount
    let amountVnd = 0;
    if (dto.paymentType === PaymentType.DEPOSIT) {
      amountVnd = Number(booking.pricingSnapshot.depositVnd);
    } else if (dto.paymentType === PaymentType.FULL_PAYMENT) {
      amountVnd = Number(booking.pricingSnapshot.totalVnd);
    } else {
      amountVnd =
        Number(booking.pricingSnapshot.subtotalVnd) + Number(booking.pricingSnapshot.serviceFeeVnd);
    }

    if (amountVnd <= 0) {
      amountVnd = Number(booking.pricingSnapshot.depositVnd);
    }

    const transactionRef = `TX-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const signature = computePaymentSignature(transactionRef, amountVnd, PaymentStatus.PENDING);
    const paymentUrl = `/checkout/payment-gateway?ref=${transactionRef}&amount=${amountVnd}&type=${dto.paymentType}`;

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        renterId: actorId,
        amountVnd: BigInt(amountVnd),
        paymentType: dto.paymentType,
        status: PaymentStatus.PENDING,
        provider: 'SANDBOX_GATEWAY',
        transactionRef,
        paymentUrl,
        signature,
      },
    });

    return this.formatPaymentResponse(payment);
  }

  async processWebhook(dto: PaymentWebhookDto): Promise<PaymentResponseDto> {
    // 1. Verify HMAC Signature
    const expectedSignature = computePaymentSignature(
      dto.transactionRef,
      dto.amountVnd,
      dto.status,
    );

    if (dto.signature !== expectedSignature) {
      throw new ForbiddenException({
        code: 'INVALID_SIGNATURE',
        message: 'Chữ ký số xác thực HMAC-SHA512 từ cổng thanh toán không khớp',
      });
    }

    // 2. Find payment
    const payment = await this.prisma.payment.findUnique({
      where: { transactionRef: dto.transactionRef },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Không tìm thấy mã giao dịch thanh toán ${dto.transactionRef}`,
      });
    }

    // 3. Idempotency: If already resolved, return existing result
    if (payment.status !== PaymentStatus.PENDING) {
      return this.formatPaymentResponse(payment);
    }

    // 4. Update in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: dto.status,
          gatewayTxnId: dto.gatewayTxnId || `GW-${randomBytes(4).toString('hex')}`,
          paidAt: dto.status === PaymentStatus.SUCCESS ? new Date() : null,
        },
      });

      if (dto.status === PaymentStatus.SUCCESS) {
        const event = await tx.bookingEvent.create({
          data: {
            bookingId: payment.bookingId,
            actorId: payment.renterId,
            eventType: 'PAYMENT_RECEIVED',
            reason: `Thanh toán thành công ${payment.paymentType}: ${Number(payment.amountVnd).toLocaleString('vi-VN')} VND`,
          },
        });

        await tx.notification.create({
          data: {
            userId: payment.renterId,
            bookingId: payment.bookingId,
            eventId: event.id,
            type: 'PAYMENT_RECEIVED',
          },
        });
      } else {
        await tx.bookingEvent.create({
          data: {
            bookingId: payment.bookingId,
            actorId: payment.renterId,
            eventType: 'PAYMENT_FAILED',
            reason: `Giao dịch thanh toán ${payment.paymentType} thất bại hoặc bị hủy (${dto.status})`,
          },
        });
      }

      return p;
    });

    return this.formatPaymentResponse(updated);
  }

  async simulatePayment(dto: SimulatePaymentDto): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionRef: dto.transactionRef },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Không tìm thấy giao dịch ${dto.transactionRef} để giả lập`,
      });
    }

    const amount = Number(payment.amountVnd);
    const signature = computePaymentSignature(dto.transactionRef, amount, dto.status);

    return this.processWebhook({
      transactionRef: dto.transactionRef,
      amountVnd: amount,
      status: dto.status,
      gatewayTxnId: `SIM-${Date.now()}-${randomBytes(3).toString('hex')}`,
      signature,
    });
  }

  async getPaymentByRef(transactionRef: string, actorId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionRef },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Không tìm thấy thông tin giao dịch ${transactionRef}`,
      });
    }

    if (payment.renterId !== actorId && payment.booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xem thông tin giao dịch thanh toán này',
      });
    }

    return this.formatPaymentResponse(payment);
  }

  private formatPaymentResponse(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      renterId: payment.renterId,
      amountVnd: Number(payment.amountVnd),
      paymentType: payment.paymentType,
      status: payment.status,
      provider: payment.provider,
      transactionRef: payment.transactionRef,
      paymentUrl: payment.paymentUrl || null,
      gatewayTxnId: payment.gatewayTxnId || null,
      paidAt: payment.paidAt instanceof Date ? payment.paidAt.toISOString() : payment.paidAt,
      createdAt:
        payment.createdAt instanceof Date ? payment.createdAt.toISOString() : payment.createdAt,
    };
  }
}
