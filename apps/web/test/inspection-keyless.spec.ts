import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const TEST_BOOKING_ID = '20000000-0000-4000-8000-000000000088';
const VEHICLE_ID = '10000000-0000-0000-0000-000000000004'; // Mazda CX-5 2.0 Premium (keylessSupported: true)
const RENTER_ID = '00000000-0000-0000-0000-000000000003'; // Thuê 1
const OWNER_ID = '00000000-0000-0000-0000-000000000001'; // Chủ 1

async function resetTestBooking() {
  const prisma = new PrismaClient();
  try {
    // Delete any previous child records
    await prisma.keylessOperation.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.inspectionPhoto.deleteMany({
      where: { inspection: { bookingId: TEST_BOOKING_ID } },
    });
    await prisma.inspection.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.bookingEvent.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.vehicleCalendar.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.pricingSnapshot.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
    await prisma.booking.deleteMany({ where: { id: TEST_BOOKING_ID } });

    const now = new Date();
    const startAt = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago (within early pickup buffer)
    const endAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days in future

    // Create fresh APPROVED booking
    await prisma.booking.create({
      data: {
        id: TEST_BOOKING_ID,
        vehicleId: VEHICLE_ID,
        renterId: RENTER_ID,
        ownerId: OWNER_ID,
        startAt,
        endAt,
        status: 'APPROVED',
        requestExpiresAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    // Create immutable pricing snapshot
    await prisma.pricingSnapshot.create({
      data: {
        id: '50000000-0000-0000-0000-000000000088',
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

    // Create calendar reservation
    await prisma.vehicleCalendar.create({
      data: {
        id: '30000000-0000-0000-0000-000000000088',
        vehicleId: VEHICLE_ID,
        bookingId: TEST_BOOKING_ID,
        kind: 'BOOKING',
        startAt,
        endAt,
        releasedAt: null,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test.describe('Milestone G4 Web Flow (Handover Checklist & Virtual Keyless Operations)', () => {
  test.beforeEach(async () => {
    await resetTestBooking();
  });

  test.afterAll(async () => {
    const prisma = new PrismaClient();
    try {
      await prisma.keylessOperation.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
      await prisma.inspectionPhoto.deleteMany({
        where: { inspection: { bookingId: TEST_BOOKING_ID } },
      });
      await prisma.inspection.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
      await prisma.bookingEvent.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
      await prisma.vehicleCalendar.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
      await prisma.pricingSnapshot.deleteMany({ where: { bookingId: TEST_BOOKING_ID } });
      await prisma.booking.deleteMany({ where: { id: TEST_BOOKING_ID } });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('renter performs 4-angle vehicle checklist, finalizes handover, unlocks keyless to start trip, and locks doors', async ({
    page,
  }) => {
    // 1. Visit homepage & login as renter1
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'CarShare — Trang chủ' })).toBeVisible();

    const loginBtn = page.locator('#nav-login-btn');
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();

    await expect(page.locator('#auth-modal-content')).toBeVisible();
    const renterQuickBtn = page.locator('#quick-login-renter1');
    await expect(renterQuickBtn).toBeVisible();
    await renterQuickBtn.click();

    await expect(page.locator('#nav-user-name')).toHaveText('Thuê 1', { timeout: 10000 });

    // 2. Navigate to test booking details page
    await page.goto(`/bookings/${TEST_BOOKING_ID}`);

    // Verify booking details header & plate revealed
    await expect(page.locator('h1')).toContainText('Chi tiết chuyến đi');
    await expect(page.locator('#booking-detail-plate')).toContainText('51K-10004');

    // Verify Handover card & Keyless widget presence
    const inspectionCard = page.locator('#booking-inspection-card');
    await expect(inspectionCard).toBeVisible();
    await expect(page.locator('#inspection-status-pill')).toContainText('Chưa hoàn tất');

    const keylessWidget = page.locator('#keyless-remote-widget');
    await expect(keylessWidget).toBeVisible();
    await expect(page.locator('#keyless-door-status')).toContainText('ĐÃ KHÓA CỬA');

    // Verify safety gatekeeper warning is shown
    const inspectionWarning = page.locator('#keyless-inspection-warning');
    await expect(inspectionWarning).toBeVisible();
    await expect(inspectionWarning).toContainText('trước khi mở khóa');

    // 3. Attempt to UNLOCK without checklist -> safety gatekeeper blocks action
    const unlockBtn = page.locator('#btn-keyless-unlock');
    await expect(unlockBtn).toBeVisible();
    await unlockBtn.click();

    const errorBanner = page.locator('#keyless-error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Quy định an toàn');

    // 4. Open Inspection Checklist Modal
    const openInspectionBtn = page.locator('#btn-open-inspection');
    await expect(openInspectionBtn).toBeVisible();
    await openInspectionBtn.click();

    const modal = page.locator('#inspection-checklist-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toContainText('nhận xe');

    // 5. Upload 4 angle photos directly to MinIO S3
    const samplePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const angles = ['front', 'rear', 'left', 'right'];
    for (const angle of angles) {
      const fileInput = page.locator(`#input-photo-${angle}`);
      await fileInput.setInputFiles({
        name: `car-${angle}.png`,
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });

      // Wait for the card to transition to "Đã chụp"
      await expect(page.locator(`#inspection-card-${angle}`)).toContainText('Đã chụp', {
        timeout: 15000,
      });
    }

    // 6. Fill Odometer, Fuel & Damage Notes
    const odoInput = page.locator('#input-inspection-odometer');
    await odoInput.fill('15500');

    const notesInput = page.locator('#input-inspection-notes');
    await notesInput.fill('Xe sạch sẽ, ngoại thất nguyên vẹn, lốp đủ áp suất.');

    // 7. Save Draft
    const saveDraftBtn = page.locator('#btn-save-inspection-draft');
    await expect(saveDraftBtn).toBeVisible();
    await saveDraftBtn.click();

    const successBanner = page.locator('#inspection-success-banner');
    await expect(successBanner).toBeVisible({ timeout: 10000 });
    await expect(successBanner).toContainText('Đã lưu bản nháp');

    // 8. Finalize Handover Inspection (locks checklist permanently)
    const finalizeBtn = page.locator('#btn-finalize-inspection');
    await expect(finalizeBtn).toBeEnabled();
    await finalizeBtn.click();

    // Modal closes upon successful finalization
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // 9. Verify UI updates on booking page
    await expect(page.locator('#inspection-status-pill')).toContainText('Đã chốt biên bản');
    await expect(page.locator('#keyless-inspection-warning')).not.toBeVisible();
    await expect(page.locator('#keyless-inspection-passed')).toBeVisible();

    // 10. UNLOCK the vehicle via Keyless Virtual Remote
    // This calls backend KeylessService, simulator verifies and transitions booking to IN_PROGRESS
    await unlockBtn.click();

    // Verify door status updates to UNLOCKED
    await expect(page.locator('#keyless-door-status')).toContainText('ĐÃ MỞ KHÓA', {
      timeout: 15000,
    });
    await expect(page.locator('#keyless-success-banner')).toContainText('Chốt cửa đã mở');

    // Verify booking status transitioned to IN_PROGRESS on the page
    await expect(page.locator('text=Chuyến đi đang diễn ra')).toBeVisible({ timeout: 10000 });

    // 11. LOCK the vehicle via Keyless Virtual Remote
    const lockBtn = page.locator('#btn-keyless-lock');
    await expect(lockBtn).toBeVisible();
    await lockBtn.click();

    // Verify door status updates back to LOCKED
    await expect(page.locator('#keyless-door-status')).toContainText('ĐÃ KHÓA CỬA', {
      timeout: 15000,
    });
    await expect(page.locator('#keyless-success-banner')).toContainText('khóa an toàn');
  });
});
