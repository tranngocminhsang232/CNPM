import { test, expect, type Page } from '@playwright/test';
import type { VehicleDetail, User, Booking } from '../src/lib/api';

const vehicle: VehicleDetail = {
  id: '10000000-0000-0000-0000-000000000001',
  brand: 'VinFast',
  model: 'VF8 Plus',
  year: 2024,
  city: 'TP. Hồ Chí Minh',
  carType: 'SUV',
  transmission: 'AUTO',
  seats: 5,
  description: 'Xe được bảo dưỡng định kỳ, phù hợp với những chuyến đi cùng gia đình.',
  amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA'],
  keylessSupported: true,
  photoUrls: [
    '/images/vehicles/10000000-0000-0000-0000-000000000001/cover.jpg',
    '/images/vehicles/10000000-0000-0000-0000-000000000001/photo-2.jpg',
  ],
  pricePerDayVnd: 1400000,
  ratingAverage: 4.9,
  reviewCount: 12,
  totalTrips: 15,
  owner: { id: 'owner-ui-test', name: 'Chủ xe kiểm thử', joinedAt: '2026-01-01T00:00:00Z' },
};
const user: User = {
  id: 'user-ui-test',
  name: 'Người dùng kiểm thử',
  email: 'ui@example.test',
  phone: '0900000000',
  kycStatus: 'VERIFIED',
  capabilities: [],
};

const booking: Booking = {
  id: '20000000-0000-0000-0000-000000000001',
  vehicleId: vehicle.id,
  renterId: user.id,
  ownerId: vehicle.owner.id,
  startAt: '2026-12-01T01:00:00Z',
  endAt: '2026-12-03T01:00:00Z',
  status: 'APPROVED',
  requestExpiresAt: '2026-12-01T00:00:00Z',
  version: 1,
  createdAt: '2026-11-01T01:00:00Z',
  vehicle: { ...vehicle, coverImageUrl: vehicle.photoUrls[0] },
  renter: { id: user.id, name: user.name, phone: user.phone },
  owner: { id: vehicle.owner.id, name: vehicle.owner.name, phone: '0900000001' },
  pricingSnapshot: {
    currency: 'VND',
    pricePerDayVnd: 1400000,
    rentalDays: 2,
    subtotalVnd: 2800000,
    serviceFeeVnd: 280000,
    depositVnd: 10000000,
    totalVnd: 13080000,
    pricingVersion: 'daily-v1',
  },
};

async function mockApi(page: Page, authenticated = false) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown = null;
    if (path.endsWith('/auth/me')) {
      await route.fulfill({
        status: authenticated ? 200 : 401,
        json: { data: authenticated ? user : null },
      });
      return;
    }
    if (path.endsWith('/auth/csrf')) data = { csrfToken: 'ui-test-token' };
    else if (path.endsWith('/auth/login')) {
      await route.fulfill({
        status: 401,
        json: { error: { message: 'Thông tin đăng nhập chưa đúng' } },
      });
      return;
    } else if (path === '/api/v1/vehicles') {
      const city = url.searchParams.get('city');
      const results = Array.from({ length: 6 }, (_, i) => ({
        ...vehicle,
        id: `10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
        city: city || vehicle.city,
        reviewCount: i === 1 ? 0 : 12,
        coverImageUrl: `/images/vehicles/10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}/cover.jpg`,
      }));
      await route.fulfill({
        json: {
          data: results,
          meta: {
            page: Number(url.searchParams.get('page') || 1),
            pageSize: 6,
            total: 12,
            totalPages: 2,
          },
        },
      });
      return;
    } else if (path.endsWith(`/vehicles/${vehicle.id}`)) data = vehicle;
    else if (path.endsWith(`/bookings/${booking.id}`)) data = booking;
    else if (
      path.includes('/bookings/') &&
      (path.endsWith('/reviews') || path.endsWith('/inspections'))
    )
      data = [];
    else if (path.endsWith('/reviews')) data = { averageScore: 0, totalReviews: 0, reviews: [] };
    else if (path.endsWith('/pricing/quote'))
      data = {
        vehicleId: vehicle.id,
        startAt: '2026-12-01T01:00:00Z',
        endAt: '2026-12-03T01:00:00Z',
        pricePerDayVnd: 1400000,
        rentalDays: 2,
        subtotalVnd: 2800000,
        serviceFeeVnd: 280000,
        depositVnd: 10000000,
        totalVnd: 13080000,
        pricingVersion: 'daily-v1',
        available: true,
        breakdown: {
          rentalDays: 2,
          baseRentVnd: 2800000,
          peakSurchargeVnd: 0,
          insuranceFeeVnd: 0,
          discountVnd: 0,
          subtotalVnd: 2800000,
          serviceFeeVnd: 280000,
          depositVnd: 10000000,
        },
      };
    else if (path.endsWith('/owner/vehicles') || path.endsWith('/bookings')) data = [];
    else if (path.endsWith('/vehicle-options')) {
      await route.fulfill({
        json: {
          cities: ['TP. Hồ Chí Minh', 'Hà Nội'],
          carTypes: ['SUV', 'SEDAN'],
          transmissions: ['AUTO', 'MANUAL'],
          amenities: [{ code: 'GPS', name: 'GPS' }],
        },
      });
      return;
    }
    await route.fulfill({ json: { data } });
  });
}

test('filters, reset and pagination keep working', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByTestId('vehicle-card')).toHaveCount(6);
  await expect(page.getByText('Chưa có đánh giá')).toBeVisible();
  await page.getByTestId('city-select').selectOption('Hà Nội');
  await expect(page.getByTestId('vehicle-card').first()).toContainText('Hà Nội');
  await page.getByTestId('keyless-checkbox').check();
  await expect(page.getByTestId('keyless-badge').first()).toBeVisible();
  await page.getByTestId('next-page-btn').click();
  await expect(page.getByRole('navigation', { name: 'Phân trang danh sách xe' })).toContainText(
    '2 / 2',
  );
  await page.getByTestId('reset-filter-btn').click();
  await expect(page.getByTestId('city-select')).toHaveValue('ALL');
  await expect(page.getByTestId('keyless-checkbox')).not.toBeChecked();
  await expect(page.getByTestId('prev-page-btn')).toBeDisabled();
});

test('failed request does not masquerade as zero results and can retry', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/vehicles?**', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/');
  await expect(page.getByTestId('error-state')).toBeVisible();
  await expect(page.getByTestId('total-count')).toHaveCount(0);
  await page.unroute('**/api/v1/vehicles?**');
  await page.getByTestId('retry-btn').click();
  await expect(page.getByTestId('vehicle-card')).toHaveCount(6);
});

test('empty search explains how to recover', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/vehicles?**', (route) =>
    route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 6, total: 0, totalPages: 1 } } }),
  );
  await page.goto('/');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đặt lại tất cả bộ lọc' })).toBeVisible();
});

test('quote failure prevents booking with an old or missing quote', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/pricing/quote', (route) =>
    route.fulfill({ status: 503, json: { error: { message: 'Chưa thể tính giá' } } }),
  );
  await page.goto(`/vehicles/${vehicle.id}`);
  await expect(page.getByText('Chưa thể tính giá', { exact: true })).toBeVisible();
  await expect(page.locator('#proceed-to-book-btn')).toBeDisabled();
});

test('rental dates explain invalid ranges and insurance announces selection', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/vehicles/${vehicle.id}`);
  await expect(page.locator('#quote-total-price')).toBeVisible();
  await page.locator('#insurance-standard-btn').click();
  await expect(page.locator('#insurance-standard-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#end-date-input').fill('2020-01-01T08:00');
  await expect(page.locator('#rental-date-error')).toContainText('phải sau');
  await expect(page.locator('#proceed-to-book-btn')).toBeDisabled();
  await expect(page.locator('#end-date-input')).toHaveAttribute('aria-invalid', 'true');
});

const checkoutPath = `/checkout?vehicleId=${vehicle.id}&startAt=2026-12-01T01:00:00Z&endAt=2026-12-03T01:00:00Z`;
test('checkout retains summary and allows retry after booking fails', async ({ page }) => {
  await mockApi(page, true);
  await page.route('**/api/v1/bookings', (route) =>
    route.fulfill({ status: 503, json: { error: { message: 'Chưa thể gửi yêu cầu. Thử lại.' } } }),
  );
  await page.goto(checkoutPath);
  await page.locator('#confirm-booking-btn').click();
  await expect(page.locator('#checkout-error-alert')).toContainText('Chưa thể gửi');
  await expect(page.locator('#checkout-total-price')).toContainText('13.080.000');
  await expect(page.locator('#confirm-booking-btn')).toBeEnabled();
});
test('checkout explains anonymous access and opens login in context', async ({ page }) => {
  await mockApi(page);
  await page.goto(checkoutPath);
  await expect(page.locator('#confirm-booking-btn')).toBeDisabled();
  await page.getByRole('button', { name: 'Đăng nhập để tiếp tục' }).click();
  await expect(page.getByRole('dialog', { name: 'Đăng nhập tài khoản' })).toBeVisible();
});

test('license form requires login and never prefills personal dates', async ({ page }) => {
  await mockApi(page);
  await page.goto('/profile/kyc');
  await expect(page.getByRole('button', { name: 'Đăng nhập để tiếp tục' })).toBeVisible();
  await expect(page.locator('#kyc-submit-btn')).toHaveCount(0);
  await page.unroute('**/api/v1/**');
  await mockApi(page, true);
  await page.reload();
  await expect(page.locator('#kyc-dob')).toHaveValue('');
  await expect(page.locator('#kyc-expiry')).toHaveValue('');
  await expect(page.locator('#kyc-fullname')).toHaveValue(user.name);
});

test('trip filters announce selection and network failures offer retry', async ({ page }) => {
  await mockApi(page, true);
  await page.route('**/api/v1/bookings?**', (route) =>
    route.fulfill({ status: 503, json: { error: { message: 'Chưa tải được chuyến đi' } } }),
  );
  await page.goto('/bookings');
  await expect(page.getByRole('button', { name: 'Thử tải lại chuyến đi' })).toBeVisible();
  await page.getByTestId('tab-approved').click();
  await expect(page.getByTestId('tab-approved')).toHaveAttribute('aria-pressed', 'true');
});

test('a late response cannot replace the latest city selection', async ({ page }) => {
  await mockApi(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/vehicles?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('city') === 'Hà Nội') {
      await gate;
      await route.fulfill({
        json: {
          data: [{ ...vehicle, city: 'Hà Nội' }],
          meta: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
        },
      });
    } else await route.fallback();
  });
  await page.goto('/');
  await expect(page.getByTestId('vehicle-card')).toHaveCount(6);
  const slow = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get('city') === 'Hà Nội',
  );
  await page.getByTestId('city-select').selectOption('Hà Nội');
  await slow;
  await page.getByTestId('city-select').selectOption('Đà Nẵng');
  await expect(page.getByTestId('vehicle-card').first()).toContainText('Đà Nẵng');
  const finished = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get('city') === 'Hà Nội',
  );
  release();
  await finished;
  await expect(page.getByTestId('vehicle-card')).toHaveCount(6);
  await expect(page.getByTestId('vehicle-card').first()).toContainText('Đà Nẵng');
});

test('account menu supports keyboard, outside click and focus return', async ({ page }) => {
  await mockApi(page, true);
  await page.goto('/');
  const trigger = page.locator('#user-menu-trigger');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.getByRole('heading', { name: 'Xe dành cho bạn' }).click();
  await expect(page.locator('#user-menu-dropdown')).toHaveCount(0);
});

test('detail keeps gallery, quote and sign-in dialog accessible', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/vehicles/${vehicle.id}`);
  await expect(page.locator('#quote-total-price')).toContainText('13.080.000');
  await page.getByRole('button', { name: /Xem ảnh 2/ }).click();
  await expect(page.locator('#main-vehicle-photo')).toHaveAttribute('src', /photo-2/);
  const cta = page.locator('#proceed-to-book-btn');
  await cta.click();
  await expect(page.getByRole('dialog', { name: 'Đăng nhập tài khoản' })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#auth-submit-btn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cta).toBeFocused();
});

test('login errors remain visible after the request completes', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.locator('#nav-login-btn').click();
  await page.locator('#auth-email-input').fill('ui@example.test');
  await page.locator('#auth-submit-btn').click();
  await expect(page.locator('#auth-error-alert')).toContainText('Thông tin đăng nhập chưa đúng');
});

test('anonymous owner dashboard offers a next step instead of waiting indefinitely', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/owner/dashboard');
  await expect(page.getByRole('heading', { name: 'Quản lý việc cho thuê xe' })).toBeVisible();
  await expect(page.locator('#nav-login-btn')).toBeVisible();
});

test('inspection dialog is usable on a narrow phone', async ({ page }, testInfo) => {
  await mockApi(page, true);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/bookings/${booking.id}`);
  await page.locator('#btn-open-inspection-modal').click();
  await expect(page.getByRole('dialog', { name: 'Kiểm tra và nhận xe' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('inspection-360.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-open-inspection-modal')).toBeFocused();
});

test('all screens fit desktop, tablet and narrow phones', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await mockApi(page, true);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/',
      `/vehicles/${vehicle.id}`,
      '/bookings',
      `/bookings/${booking.id}`,
      '/owner/dashboard',
      '/owner/bookings',
      '/owner/vehicles',
      '/owner/vehicles/new',
      '/profile/kyc',
      `/checkout?vehicleId=${vehicle.id}&startAt=2026-12-01T01:00:00Z&endAt=2026-12-03T01:00:00Z`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${path} at ${width}px`).toBe(false);
      if (width !== 360)
        await page.screenshot({
          path: testInfo.outputPath(
            `${width}-${(path.split('?')[0] || 'home').replaceAll('/', '_')}.png`,
          ),
          fullPage: true,
        });
    }
  }
  expect(errors).toEqual([]);
});
