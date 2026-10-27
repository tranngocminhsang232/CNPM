import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

describe('ReviewsService (unit) - G5-03 Two-Way Reviews Engine', () => {
  let service: ReviewsService;
  let mockPrisma: any;

  const ACTOR_RENTER = '00000000-0000-0000-0000-000000000003';
  const ACTOR_OWNER = '00000000-0000-0000-0000-000000000001';
  const THIRD_PARTY = '00000000-0000-0000-0000-000000000009';
  const BOOKING_ID = '20000000-0000-0000-0000-000000000001';
  const VEHICLE_ID = '10000000-0000-0000-0000-000000000001';

  const mockBooking = {
    id: BOOKING_ID,
    vehicleId: VEHICLE_ID,
    renterId: ACTOR_RENTER,
    ownerId: ACTOR_OWNER,
    status: 'COMPLETED',
    renter: { id: ACTOR_RENTER, name: 'Nguyễn Văn Renter' },
    owner: { id: ACTOR_OWNER, name: 'Trần Văn Owner' },
  };

  beforeEach(() => {
    mockPrisma = {
      booking: {
        findUnique: async ({ where }: any) => {
          if (where.id === BOOKING_ID) return mockBooking;
          return null;
        },
      },
      vehicle: {
        findUnique: async ({ where }: any) => {
          if (where.id === VEHICLE_ID) return { id: VEHICLE_ID };
          return null;
        },
      },
      review: {
        findUnique: async () => null,
        findMany: async () => [],
        create: async (args: any) => ({
          id: 'rev-uuid-1',
          ...args.data,
          createdAt: new Date(),
          author: { id: args.data.authorId, name: 'Test Author' },
          targetUser: { id: args.data.targetUserId, name: 'Test Target' },
        }),
      },
      bookingEvent: {
        create: async (args: any) => ({ id: 'evt-uuid-1', ...args.data }),
      },
      notification: {
        create: async (args: any) => ({ id: 'notif-uuid-1', ...args.data }),
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    service = new ReviewsService(mockPrisma);
  });

  describe('createReview', () => {
    it('rejects 404 if booking not found', async () => {
      mockPrisma.booking.findUnique = async () => null;

      await assert.rejects(
        () =>
          service.createReview('non-existent', ACTOR_RENTER, {
            score: 5,
            comment: 'Tuyệt vời',
          }),
        (err: any) =>
          err instanceof NotFoundException && (err.getResponse() as any)?.code === 'NOT_FOUND',
      );
    });

    it('rejects 403 if unrelated user tries to write a review', async () => {
      await assert.rejects(
        () =>
          service.createReview(BOOKING_ID, THIRD_PARTY, {
            score: 5,
            comment: 'Tuyệt vời',
          }),
        (err: any) =>
          err instanceof ForbiddenException && (err.getResponse() as any)?.code === 'FORBIDDEN',
      );
    });

    it('rejects 409 if booking is not COMPLETED', async () => {
      mockPrisma.booking.findUnique = async () => ({
        ...mockBooking,
        status: 'IN_PROGRESS',
      });

      await assert.rejects(
        () =>
          service.createReview(BOOKING_ID, ACTOR_RENTER, {
            score: 5,
            comment: 'Tuyệt vời',
          }),
        (err: any) =>
          err instanceof ConflictException &&
          (err.getResponse() as any)?.code === 'INVALID_BOOKING_STATUS',
      );
    });

    it('rejects 409 ALREADY_REVIEWED if author has already reviewed this booking', async () => {
      mockPrisma.review.findUnique = async () => ({
        id: 'existing-rev',
        bookingId: BOOKING_ID,
        authorId: ACTOR_RENTER,
      });

      await assert.rejects(
        () =>
          service.createReview(BOOKING_ID, ACTOR_RENTER, {
            score: 5,
            comment: 'Tuyệt vời',
          }),
        (err: any) =>
          err instanceof ConflictException &&
          (err.getResponse() as any)?.code === 'ALREADY_REVIEWED',
      );
    });

    it('renter writes review for owner, automatically targeting owner, emitting event and notification', async () => {
      let createdReview: any = null;
      let createdEvent: any = null;
      let createdNotif: any = null;

      mockPrisma.review.create = async (args: any) => {
        createdReview = args.data;
        return {
          id: 'rev-renter-1',
          ...args.data,
          createdAt: new Date(),
          author: mockBooking.renter,
          targetUser: mockBooking.owner,
        };
      };

      mockPrisma.bookingEvent.create = async (args: any) => {
        createdEvent = args.data;
        return { id: 'evt-1', ...args.data };
      };

      mockPrisma.notification.create = async (args: any) => {
        createdNotif = args.data;
        return { id: 'notif-1', ...args.data };
      };

      const res = await service.createReview(BOOKING_ID, ACTOR_RENTER, {
        score: 5,
        comment: 'Xe chạy rất đầm và êm ái, chủ xe thân thiện!',
      });

      assert.equal(res.bookingId, BOOKING_ID);
      assert.equal(res.score, 5);
      assert.equal(res.authorId, ACTOR_RENTER);
      assert.equal(res.targetUserId, ACTOR_OWNER);
      assert.equal(createdReview.targetUserId, ACTOR_OWNER);
      assert.equal(createdEvent.eventType, 'REVIEW_SUBMITTED');
      assert.equal(createdNotif.userId, ACTOR_OWNER);
    });

    it('owner writes review for renter, automatically targeting renter', async () => {
      let createdReview: any = null;

      mockPrisma.review.create = async (args: any) => {
        createdReview = args.data;
        return {
          id: 'rev-owner-1',
          ...args.data,
          createdAt: new Date(),
          author: mockBooking.owner,
          targetUser: mockBooking.renter,
        };
      };

      const res = await service.createReview(BOOKING_ID, ACTOR_OWNER, {
        score: 5,
        comment: 'Khách giữ xe rất sạch sẽ, đúng giờ!',
      });

      assert.equal(res.authorId, ACTOR_OWNER);
      assert.equal(res.targetUserId, ACTOR_RENTER);
      assert.equal(createdReview.targetUserId, ACTOR_RENTER);
    });
  });

  describe('getBookingReviews', () => {
    it('rejects 404 if booking not found', async () => {
      mockPrisma.booking.findUnique = async () => null;

      await assert.rejects(
        () => service.getBookingReviews('non-existent'),
        (err: any) =>
          err instanceof NotFoundException && (err.getResponse() as any)?.code === 'NOT_FOUND',
      );
    });

    it('returns reviews for the booking', async () => {
      mockPrisma.review.findMany = async () => [
        {
          id: 'rev-1',
          bookingId: BOOKING_ID,
          authorId: ACTOR_RENTER,
          targetUserId: ACTOR_OWNER,
          score: 5,
          comment: 'Xe tuyệt vời',
          createdAt: new Date(),
          author: mockBooking.renter,
          targetUser: mockBooking.owner,
        },
      ];

      const res = await service.getBookingReviews(BOOKING_ID, ACTOR_RENTER);
      assert.equal(res.length, 1);
      assert.equal(res[0]!.score, 5);
      assert.equal(res[0]!.author?.name, 'Nguyễn Văn Renter');
    });
  });

  describe('getVehicleReviews', () => {
    it('rejects 404 if vehicle not found', async () => {
      mockPrisma.vehicle.findUnique = async () => null;

      await assert.rejects(
        () => service.getVehicleReviews('non-existent'),
        (err: any) =>
          err instanceof NotFoundException && (err.getResponse() as any)?.code === 'NOT_FOUND',
      );
    });

    it('calculates averageScore and totalReviews correctly', async () => {
      mockPrisma.review.findMany = async () => [
        {
          id: 'rev-1',
          bookingId: BOOKING_ID,
          authorId: ACTOR_RENTER,
          targetUserId: ACTOR_OWNER,
          score: 5,
          comment: 'Tuyệt vời',
          createdAt: new Date(),
          booking: { renterId: ACTOR_RENTER },
          author: mockBooking.renter,
          targetUser: mockBooking.owner,
        },
        {
          id: 'rev-2',
          bookingId: 'booking-2',
          authorId: 'renter-2',
          targetUserId: ACTOR_OWNER,
          score: 4,
          comment: 'Xe tốt',
          createdAt: new Date(),
          booking: { renterId: 'renter-2' },
          author: { id: 'renter-2', name: 'Renter Hai' },
          targetUser: mockBooking.owner,
        },
      ];

      const res = await service.getVehicleReviews(VEHICLE_ID);
      assert.equal(res.totalReviews, 2);
      assert.equal(res.averageScore, 4.5); // (5 + 4) / 2 = 4.5
      assert.equal(res.reviews.length, 2);
    });
  });
});
