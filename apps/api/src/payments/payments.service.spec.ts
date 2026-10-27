import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PaymentsService, computePaymentSignature } from './payments.service';
import { PaymentStatus, PaymentType } from '@prisma/client';

describe('PaymentsService (unit) - G3-02 Payment Gateway & Escrow', () => {
  let service: PaymentsService;
  let mockPrisma: any;

  const ACTOR_RENTER = '00000000-0000-0000-0000-000000000003';
  const ACTOR_OWNER = '00000000-0000-0000-0000-000000000001';
  const THIRD_PARTY = '00000000-0000-0000-0000-000000000009';
  const BOOKING_ID = '20000000-0000-0000-0000-000000000001';

  const mockBooking = {
    id: BOOKING_ID,
    renterId: ACTOR_RENTER,
    ownerId: ACTOR_OWNER,
    status: 'REQUESTED',
    pricingSnapshot: {
      depositVnd: BigInt(10000000),
      subtotalVnd: BigInt(4200000),
      serviceFeeVnd: BigInt(420000),
      totalVnd: BigInt(14620000),
    },
    vehicle: {
      id: '10000000-0000-0000-0000-000000000001',
      brand: 'VinFast',
      model: 'VF8 Plus',
    },
  };

  const mockPayment = {
    id: '50000000-0000-0000-0000-000000000001',
    bookingId: BOOKING_ID,
    renterId: ACTOR_RENTER,
    amountVnd: BigInt(10000000),
    paymentType: PaymentType.DEPOSIT,
    status: PaymentStatus.PENDING,
    provider: 'SANDBOX_GATEWAY',
    transactionRef: 'TX-TEST-0001',
    paymentUrl: '/checkout/payment-gateway?ref=TX-TEST-0001',
    gatewayTxnId: null,
    signature: 'sig-test',
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    booking: mockBooking,
  };

  beforeEach(() => {
    mockPrisma = {
      booking: {
        findUnique: async ({ where }: any) => {
          if (where.id === BOOKING_ID) return mockBooking;
          return null;
        },
      },
      payment: {
        create: async (args: any) => ({
          id: '50000000-0000-0000-0000-000000000099',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findUnique: async ({ where }: any) => {
          if (where.transactionRef === 'TX-TEST-0001') return mockPayment;
          return null;
        },
        update: async (args: any) => ({
          ...mockPayment,
          status: args.data.status,
          gatewayTxnId: args.data.gatewayTxnId,
          paidAt: args.data.paidAt,
        }),
      },
      bookingEvent: {
        create: async (args: any) => ({ id: 'event-uuid-1', ...args.data }),
      },
      notification: {
        create: async (args: any) => ({ id: 'notif-uuid-1', ...args.data }),
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    service = new PaymentsService(mockPrisma);
  });

  describe('computePaymentSignature', () => {
    it('produces deterministic 128-char HMAC-SHA512 hex signature', () => {
      const sig1 = computePaymentSignature('TX-12345', 10000000, 'SUCCESS', 'secret');
      const sig2 = computePaymentSignature('TX-12345', 10000000, 'SUCCESS', 'secret');
      assert.equal(sig1, sig2);
      assert.equal(sig1.length, 128);

      // Different status produces different signature
      const sig3 = computePaymentSignature('TX-12345', 10000000, 'FAILED', 'secret');
      assert.notEqual(sig1, sig3);
    });
  });

  describe('createPaymentIntent', () => {
    it('rejects 404 if booking not found', async () => {
      await assert.rejects(
        () =>
          service.createPaymentIntent(ACTOR_RENTER, {
            bookingId: 'missing-booking-id',
            paymentType: PaymentType.DEPOSIT,
          }),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.equal((err.getResponse() as any).code, 'NOT_FOUND');
          return true;
        },
      );
    });

    it('rejects 403 if requester is not the renter', async () => {
      await assert.rejects(
        () =>
          service.createPaymentIntent(THIRD_PARTY, {
            bookingId: BOOKING_ID,
            paymentType: PaymentType.DEPOSIT,
          }),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.equal((err.getResponse() as any).code, 'FORBIDDEN');
          return true;
        },
      );
    });

    it('rejects 409 if booking is in CANCELLED status', async () => {
      mockPrisma.booking.findUnique = async () => ({
        ...mockBooking,
        status: 'CANCELLED',
      });

      await assert.rejects(
        () =>
          service.createPaymentIntent(ACTOR_RENTER, {
            bookingId: BOOKING_ID,
            paymentType: PaymentType.DEPOSIT,
          }),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.equal((err.getResponse() as any).code, 'INVALID_BOOKING_STATUS');
          return true;
        },
      );
    });

    it('creates deposit payment intent with correct amount and PENDING status', async () => {
      const res = await service.createPaymentIntent(ACTOR_RENTER, {
        bookingId: BOOKING_ID,
        paymentType: PaymentType.DEPOSIT,
      });

      assert.equal(res.bookingId, BOOKING_ID);
      assert.equal(res.renterId, ACTOR_RENTER);
      assert.equal(res.amountVnd, 10000000);
      assert.equal(res.paymentType, PaymentType.DEPOSIT);
      assert.equal(res.status, PaymentStatus.PENDING);
      assert.ok(res.transactionRef.startsWith('TX-'));
      assert.ok(res.paymentUrl?.includes(res.transactionRef));
    });

    it('creates full payment intent with total amount', async () => {
      const res = await service.createPaymentIntent(ACTOR_RENTER, {
        bookingId: BOOKING_ID,
        paymentType: PaymentType.FULL_PAYMENT,
      });

      assert.equal(res.amountVnd, 14620000);
      assert.equal(res.paymentType, PaymentType.FULL_PAYMENT);
    });
  });

  describe('processWebhook', () => {
    it('rejects 403 INVALID_SIGNATURE when HMAC signature is forged', async () => {
      await assert.rejects(
        () =>
          service.processWebhook({
            transactionRef: 'TX-TEST-0001',
            amountVnd: 10000000,
            status: PaymentStatus.SUCCESS,
            signature: 'forged-fake-signature-123456789',
          }),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.equal((err.getResponse() as any).code, 'INVALID_SIGNATURE');
          return true;
        },
      );
    });

    it('rejects 404 if transactionRef does not exist', async () => {
      const validSig = computePaymentSignature('TX-NON-EXISTENT', 10000000, PaymentStatus.SUCCESS);

      await assert.rejects(
        () =>
          service.processWebhook({
            transactionRef: 'TX-NON-EXISTENT',
            amountVnd: 10000000,
            status: PaymentStatus.SUCCESS,
            signature: validSig,
          }),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.equal((err.getResponse() as any).code, 'NOT_FOUND');
          return true;
        },
      );
    });

    it('processes SUCCESS webhook, records gatewayTxnId and emits PAYMENT_RECEIVED event', async () => {
      const validSig = computePaymentSignature('TX-TEST-0001', 10000000, PaymentStatus.SUCCESS);

      let eventEmitted = false;
      mockPrisma.bookingEvent.create = async (args: any) => {
        if (args.data.eventType === 'PAYMENT_RECEIVED') eventEmitted = true;
        return { id: 'evt-1' };
      };

      const res = await service.processWebhook({
        transactionRef: 'TX-TEST-0001',
        amountVnd: 10000000,
        status: PaymentStatus.SUCCESS,
        gatewayTxnId: 'VNP-999888',
        signature: validSig,
      });

      assert.equal(res.status, PaymentStatus.SUCCESS);
      assert.equal(res.gatewayTxnId, 'VNP-999888');
      assert.equal(eventEmitted, true);
    });

    it('returns existing payment without re-processing if already resolved (idempotent)', async () => {
      mockPrisma.payment.findUnique = async () => ({
        ...mockPayment,
        status: PaymentStatus.SUCCESS,
        gatewayTxnId: 'VNP-ALREADY-PAID',
        paidAt: new Date(),
      });

      const validSig = computePaymentSignature('TX-TEST-0001', 10000000, PaymentStatus.SUCCESS);

      let transactionCalled = false;
      mockPrisma.$transaction = async () => {
        transactionCalled = true;
      };

      const res = await service.processWebhook({
        transactionRef: 'TX-TEST-0001',
        amountVnd: 10000000,
        status: PaymentStatus.SUCCESS,
        signature: validSig,
      });

      assert.equal(res.status, PaymentStatus.SUCCESS);
      assert.equal(res.gatewayTxnId, 'VNP-ALREADY-PAID');
      assert.equal(transactionCalled, false); // Idempotent bypass!
    });
  });

  describe('simulatePayment', () => {
    it('simulates payment successfully by computing signature and executing webhook', async () => {
      const res = await service.simulatePayment({
        transactionRef: 'TX-TEST-0001',
        status: PaymentStatus.SUCCESS,
      });

      assert.equal(res.status, PaymentStatus.SUCCESS);
      assert.ok(res.gatewayTxnId?.startsWith('SIM-'));
    });
  });

  describe('getPaymentByRef', () => {
    it('rejects 403 if unrelated user queries payment', async () => {
      await assert.rejects(
        () => service.getPaymentByRef('TX-TEST-0001', THIRD_PARTY),
        (err: any) => err instanceof ForbiddenException,
      );
    });

    it('allows renter to view payment details', async () => {
      const res = await service.getPaymentByRef('TX-TEST-0001', ACTOR_RENTER);
      assert.equal(res.transactionRef, 'TX-TEST-0001');
      assert.equal(res.amountVnd, 10000000);
    });
  });
});
