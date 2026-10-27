import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Milestone G3 Web Flow (Checkout, Escrow Payment & Trip Management)', () => {
  test.beforeAll(async () => {
    const prisma = new PrismaClient();
    try {
      const seedIds = [
        '20000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000004',
      ];
      const testBookings = await prisma.booking.findMany({
        where: { id: { notIn: seedIds } },
        select: { id: true },
      });
      const ids = testBookings.map((b) => b.id);
      if (ids.length > 0) {
        await prisma.idempotencyRecord.deleteMany({ where: { bookingId: { in: ids } } });
        await prisma.payment.deleteMany({ where: { bookingId: { in: ids } } });
        await prisma.vehicleCalendar.deleteMany({ where: { bookingId: { in: ids } } });
        await prisma.bookingEvent.deleteMany({ where: { bookingId: { in: ids } } });
        await prisma.pricingSnapshot.deleteMany({ where: { bookingId: { in: ids } } });
        await prisma.promotionUsage.deleteMany({ where: { bookingId: { in: ids } } });
        await prisma.booking.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test('end-to-end booking flow: renter creates booking, pays deposit in sandbox, owner approves, and plate/address are revealed', async ({
    page,
  }) => {
    // 1. Visit homepage & login as renter1
    await page.goto('/');
    await expect(page.locator('text=CARSHARE')).toBeVisible();

    const loginBtn = page.locator('#nav-login-btn');
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();

    await expect(page.locator('#auth-modal-content')).toBeVisible();
    const renterQuickBtn = page.locator('#quick-login-renter1');
    await expect(renterQuickBtn).toBeVisible();
    await renterQuickBtn.click();

    await expect(page.locator('#nav-user-name')).toHaveText('Lê Hoàng Thuê 1', { timeout: 10000 });

    // 2. Navigate to vehicle detail page (VinFast VF8 Eco)
    await page.goto('/vehicles/10000000-0000-0000-0000-000000000001');
    await expect(page.locator('#vehicle-detail-title')).toBeVisible({ timeout: 10000 });

    // Wait for pricing calculator quote
    const calculatorWidget = page.locator('#pricing-calculator-widget');
    await expect(calculatorWidget).toBeVisible();
    await expect(page.locator('#quote-available-badge')).toBeVisible({ timeout: 10000 });

    // 3. Click "Tiến hành đặt xe ngay" -> lands on /checkout
    const proceedBtn = page.locator('#proceed-to-book-btn');
    await expect(proceedBtn).toBeVisible();
    await proceedBtn.click();

    // Verify checkout page loaded
    await expect(page).toHaveURL(/\/checkout\?vehicleId=/);
    await expect(page.locator('h1')).toContainText('Xác nhận thông tin & Ký quỹ đặt xe');
    await expect(page.locator('#checkout-start-at')).toBeVisible();
    await expect(page.locator('#checkout-end-at')).toBeVisible();
    await expect(page.locator('#checkout-deposit-amount')).toBeVisible();
    await expect(page.locator('#checkout-total-price')).toBeVisible();

    // 4. Click "Xác nhận & Đặt xe" -> creates booking & opens PaymentModal
    const confirmBtn = page.locator('#confirm-booking-btn');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verify sandbox payment modal opened
    const paymentModal = page.locator('#payment-modal-content');
    await expect(paymentModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#payment-txn-ref')).toContainText('TX-');
    await expect(page.locator('#payment-amount-display')).toBeVisible();

    // 5. Simulate successful payment
    const simulateSuccessBtn = page.locator('#simulate-payment-success-btn');
    await expect(simulateSuccessBtn).toBeVisible();
    await simulateSuccessBtn.click();

    // 6. Redirected to /bookings/[id] with status REQUESTED
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+/, { timeout: 10000 });
    const bookingUrl = page.url();
    const bookingIdMatch = bookingUrl.match(/\/bookings\/([0-9a-f-]+)/);
    expect(bookingIdMatch).not.toBeNull();
    const bookingId = bookingIdMatch![1];

    // Verify REQUESTED state: plate is hidden, address notice is shown
    await expect(page.locator('#booking-detail-plate-hidden')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Chỉ hiển thị sau khi chủ xe phê duyệt')).toBeVisible();

    // 7. Logout renter1
    await page.locator('#user-menu-trigger').click();
    const logoutBtn = page.locator('#nav-logout-btn');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await expect(page.locator('#nav-login-btn')).toBeVisible({ timeout: 10000 });

    // 8. Login as owner1 (vehicle host)
    await page.locator('#nav-login-btn').click();
    await page.locator('#quick-login-owner1').click();
    await expect(page.locator('#nav-user-name')).toHaveText('Nguyễn Văn Chủ 1', { timeout: 10000 });

    // 9. Navigate to Owner Bookings Inbox
    await page.locator('#user-menu-trigger').click();
    const ownerBookingsLink = page.locator('#nav-owner-bookings-link');
    await expect(ownerBookingsLink).toBeVisible();
    await ownerBookingsLink.click();

    await expect(page).toHaveURL(/\/owner\/bookings/);
    await expect(page.locator('h1')).toContainText('Hộp thư yêu cầu thuê xe');

    // Find and approve the booking request
    const approveBtn = page.locator(`[data-testid="approve-booking-btn-${bookingId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();

    // After approval, the card in REQUESTED tab will disappear or show updated state
    await expect(approveBtn).not.toBeVisible({ timeout: 10000 });

    // 10. Logout owner1
    await page.locator('#user-menu-trigger').click();
    await page.locator('#nav-logout-btn').click();
    await expect(page.locator('#nav-login-btn')).toBeVisible({ timeout: 10000 });

    // 11. Login as renter1 again
    await page.locator('#nav-login-btn').click();
    await page.locator('#quick-login-renter1').click();
    await expect(page.locator('#nav-user-name')).toHaveText('Lê Hoàng Thuê 1', { timeout: 10000 });

    // 12. Return to the booking details page
    await page.goto(`/bookings/${bookingId}`);

    // Verify state is now APPROVED
    await expect(page.locator('text=Yêu cầu thuê xe đã được phê duyệt!')).toBeVisible({
      timeout: 10000,
    });

    // Verify plate and pickup address are now REVEALED
    const plateElement = page.locator('#booking-detail-plate');
    await expect(plateElement).toBeVisible();
    await expect(plateElement).toContainText('51K-10001');

    const addressElement = page.locator('#booking-detail-pickup-address');
    await expect(addressElement).toBeVisible();
    await expect(addressElement).toContainText('Nguyễn Hữu Cảnh');

    // Verify immutable pricing snapshot is displayed
    await expect(page.locator('#booking-pricing-snapshot')).toBeVisible();
    await expect(page.locator('#snapshot-deposit-amount')).toBeVisible();
  });
});
