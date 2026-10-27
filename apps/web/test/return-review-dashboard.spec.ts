import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const TEST_BOOKING_ID = '20000000-0000-4000-8000-000000000099';
const VEHICLE_ID = '10000000-0000-0000-0000-000000000004'; // Mazda CX-5
const RENTER_ID = '00000000-0000-0000-0000-000000000003'; // Lê Hoàng Thuê 1
const OWNER_ID = '00000000-0000-0000-0000-000000000001'; // Nguyễn Văn Chủ 1

async function cleanupTestBooking() {
  const prisma = new PrismaClient();
  try {
    await prisma.review.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.payment.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.keylessOperation.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.inspectionPhoto.deleteMany({
      where: { inspection: { bookingId: TEST_BOOKING_ID } },
    });
    await prisma.mediaObject.deleteMany({
      where: {
        OR: [
          { bookingId: TEST_BOOKING_ID },
          {
            id: {
              in: [
                '60000000-0000-0000-0000-000000000091',
                '60000000-0000-0000-0000-000000000092',
                '60000000-0000-0000-0000-000000000093',
                '60000000-0000-0000-0000-000000000094',
              ],
            },
          },
        ],
      },
    });
    await prisma.inspection.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.bookingEvent.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.vehicleCalendar.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.pricingSnapshot.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.booking.deleteMany({ where: { id: TEST_BOOKING_ID } });
  } finally {
    await prisma.$disconnect();
  }
}

async function seedInProgressBooking() {
  const prisma = new PrismaClient();
  try {
    await cleanupTestBooking();

    const now = new Date();
    const startAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const endAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day in future

    // 1. Create IN_PROGRESS booking
    await prisma.booking.create({
      data: {
        id: TEST_BOOKING_ID,
        vehicleId: VEHICLE_ID,
        renterId: RENTER_ID,
        ownerId: OWNER_ID,
        startAt,
        endAt,
        status: 'IN_PROGRESS',
        requestExpiresAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      },
    });

    // 2. Pricing snapshot
    await prisma.pricingSnapshot.create({
      data: {
        id: '50000000-0000-0000-0000-000000000099',
        bookingId: TEST_BOOKING_ID,
        currency: 'VND',
        pricePerDayVnd: BigInt(1400000),
        rentalDays: 2,
        subtotalVnd: BigInt(2800000),
        serviceFeeVnd: BigInt(280000),
        depositVnd: BigInt(5000000),
        totalVnd: BigInt(8080000),
        pricingVersion: '1.0',
      },
    });

    // 3. Calendar active reservation
    await prisma.vehicleCalendar.create({
      data: {
        id: '30000000-0000-0000-0000-000000000099',
        vehicleId: VEHICLE_ID,
        bookingId: TEST_BOOKING_ID,
        kind: 'BOOKING',
        startAt,
        endAt,
        releasedAt: null,
      },
    });

    // 4. Create initial media objects for check-in
    const angles = ['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const;
    const mediaIds = [
      '60000000-0000-0000-0000-000000000091',
      '60000000-0000-0000-0000-000000000092',
      '60000000-0000-0000-0000-000000000093',
      '60000000-0000-0000-0000-000000000094',
    ];

    for (let i = 0; i < angles.length; i++) {
      await prisma.mediaObject.upsert({
        where: { id: mediaIds[i] },
        create: {
          id: mediaIds[i]!,
          stagingKey: `staging/checkin_${angles[i]}.png`,
          finalKey: `bookings/${TEST_BOOKING_ID}/checkin_${angles[i]}.png`,
          checksum: 'mock-sha256-checksum',
          purpose: 'INSPECTION_PHOTO',
          mimeType: 'image/png',
          sizeBytes: 1024,
          state: 'VERIFIED',
          uploaderId: RENTER_ID,
        },
        update: {},
      });
    }

    // 5. Finalized CHECK_IN inspection
    await prisma.inspection.create({
      data: {
        id: '40000000-0000-0000-0000-000000000091',
        bookingId: TEST_BOOKING_ID,
        performedBy: RENTER_ID,
        type: 'CHECK_IN',
        odometerKm: 15000,
        fuelPercent: 90,
        damageNotes: 'Xe nhận sạch sẽ, đủ 4 góc không trầy xước.',
        version: 1,
        acknowledged: true,
        finalizedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
        photos: {
          create: [
            { angle: 'FRONT', mediaId: mediaIds[0]! },
            { angle: 'REAR', mediaId: mediaIds[1]! },
            { angle: 'LEFT', mediaId: mediaIds[2]! },
            { angle: 'RIGHT', mediaId: mediaIds[3]! },
          ],
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test.describe('Milestone G5 End-to-End Flow: Return, Settlement, Reviews & Host Dashboard', () => {
  test.beforeEach(async () => {
    await seedInProgressBooking();
  });

  test.afterAll(async () => {
    await cleanupTestBooking();
  });

  test('full end-to-end post-trip lifecycle: return checklist -> complete trip -> settle deposit -> submit reviews -> host dashboard', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    // =========================================================================
    // Phase 1: Renter returns car, uploads 4 angles, finalizes & completes trip
    // =========================================================================
    await page.goto('/');

    // Login as renter1
    await page.click('#nav-login-btn');
    await expect(page.locator('#auth-modal-content')).toBeVisible();
    await page.click('#quick-login-renter1');
    await expect(page.locator('#nav-user-name')).toBeVisible();

    // Navigate to booking detail
    await page.goto(`/bookings/${TEST_BOOKING_ID}`);

    // Verify initial state: IN_PROGRESS
    const statusBadge = page.locator('#booking-status-badge');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('Đang trong chuyến đi');

    // Click Return Car button
    const returnBtn = page.locator('#btn-open-return-modal');
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // Modal opens
    const returnModal = page.locator('#modal-return-checklist');
    await expect(returnModal).toBeVisible();

    // Upload 4 angles
    const angles = ['FRONT', 'REAR', 'LEFT', 'RIGHT'];
    for (const angle of angles) {
      const fileInput = page.locator(`#return-photo-upload-${angle}`);
      await fileInput.setInputFiles({
        name: `checkout-${angle}.png`,
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });
    }

    // Wait for all 4 angles to be uploaded
    await expect(page.locator('#return-photo-completion-badge')).toContainText('Đã chụp đủ 4 góc', {
      timeout: 15000,
    });

    // Enter return ODO (15120 km >= 15000 km) and fuel (85%)
    const returnOdoInput = page.locator('#return-odometer-input');
    await returnOdoInput.fill('15120');

    const returnFuelInput = page.locator('#return-fuel-input');
    await returnFuelInput.fill('85');

    const returnNotesInput = page.locator('#return-damage-notes-input');
    await returnNotesInput.fill('Xe hoàn trả trong tình trạng tốt, đã rửa vỏ ngoài.');

    // Finalize return inspection
    const finalizeReturnBtn = page.locator('#btn-finalize-return');
    await expect(finalizeReturnBtn).toBeEnabled();
    await finalizeReturnBtn.click();

    // Verify success banner and complete trip button
    await expect(page.locator('#return-inspection-success')).toBeVisible({ timeout: 10000 });
    const completeTripBtn = page.locator('#btn-complete-trip');
    await expect(completeTripBtn).toBeVisible();

    // Complete trip
    await completeTripBtn.click();

    // Verify booking is now COMPLETED
    await expect(page.locator('#booking-status-badge')).toContainText('hoàn thành', {
      timeout: 10000,
    });

    // Verify deposit settlement card is visible in waiting state for renter
    const depositCard = page.locator('#deposit-settlement-card');
    await expect(depositCard).toBeVisible();
    await expect(depositCard).toContainText('Đang chờ chủ xe quyết toán tiền cọc');

    // =========================================================================
    // Phase 2: Owner settles deposit with surcharges and calculates refund
    // =========================================================================
    // Logout renter
    await page.click('#user-menu-trigger');
    await page.click('#nav-logout-btn');
    await expect(page.locator('#nav-login-btn')).toBeVisible();

    // Login as owner1
    await page.click('#nav-login-btn');
    await expect(page.locator('#auth-modal-content')).toBeVisible();
    await page.click('#quick-login-owner1');
    await expect(page.locator('#nav-user-name')).toBeVisible();

    // Navigate to booking detail as owner
    await page.goto(`/bookings/${TEST_BOOKING_ID}`);
    await expect(page.locator('#booking-status-badge')).toContainText('hoàn thành');

    // Owner sees settlement form
    const ownerDepositCard = page.locator('#deposit-settlement-card');
    await expect(ownerDepositCard).toBeVisible();

    // Fill cleaning fee and notes
    await page.locator('#cleaning-fee-input').fill('100000');
    await page.locator('#settlement-notes-input').fill('Hao hụt 5% xăng và bù phí rửa xe.');

    // Click Settle Deposit button
    const settleBtn = page.locator('#btn-settle-deposit');
    await expect(settleBtn).toBeVisible();
    await settleBtn.click();

    // Verify settlement status changes to settled
    await expect(page.locator('#deposit-settlement-status-badge')).toContainText('Đã hoàn cọc', {
      timeout: 10000,
    });
    await expect(page.locator('#settled-refund-amount')).toBeVisible();

    // =========================================================================
    // Phase 3: Owner submits review for renter
    // =========================================================================
    const openReviewBtn = page.locator('#btn-open-review-modal');
    await expect(openReviewBtn).toBeVisible();
    await openReviewBtn.click();

    const reviewModal = page.locator('#modal-review');
    await expect(reviewModal).toBeVisible();

    // Select 5 stars
    await page.locator('#star-rating-5').click();

    // Fill comment
    await page
      .locator('#review-comment-input')
      .fill('Khách hàng thân thiện, giữ gìn xe rất cẩn thận và trả xe đúng hẹn!');

    // Submit review
    await page.locator('#btn-submit-review').click();
    await expect(reviewModal).not.toBeVisible();

    // Verify owner's review is displayed
    const reviewsSection = page.locator('#booking-reviews-section');
    await expect(reviewsSection).toBeVisible();
    await expect(reviewsSection).toContainText('Khách hàng thân thiện, giữ gìn xe rất cẩn thận');

    // =========================================================================
    // Phase 4: Host Dashboard reflects completed trip and revenue
    // =========================================================================
    await page.click('#user-menu-trigger');
    const dashboardLink = page.locator('#nav-owner-dashboard-link');
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();

    // On /owner/dashboard
    await expect(page).toHaveURL(/\/owner\/dashboard/);
    await expect(page.locator('#host-dashboard-title')).toBeVisible();

    // Check KPI cards
    const revenueCard = page.locator('#host-total-revenue');
    await expect(revenueCard).toBeVisible();
    const revenueText = await revenueCard.textContent();
    expect(revenueText).not.toBe('0 ₫');

    const completedStat = page.locator('#stat-count-completed');
    await expect(completedStat).toBeVisible();
    const completedCount = Number(await completedStat.textContent());
    expect(completedCount).toBeGreaterThanOrEqual(1);

    // Verify recent bookings table includes this booking
    const recentTable = page.locator('#host-recent-bookings-table');
    await expect(recentTable).toBeVisible();
    await expect(recentTable).toContainText(TEST_BOOKING_ID.slice(0, 6));
  });
});
