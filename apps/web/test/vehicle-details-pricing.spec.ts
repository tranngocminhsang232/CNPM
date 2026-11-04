import { test, expect } from '@playwright/test';

test.describe('Milestone G2 Web Flow (Vehicle Details & Pricing Calculator)', () => {
  test('user views vehicle details, calculates quote, switches insurance, and applies voucher', async ({
    page,
  }) => {
    // 1. Visit homepage
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'CarShare — Trang chủ' })).toBeVisible();

    // 2. Click "Xem chi tiết" on the first visible vehicle card
    const firstDetailBtn = page.locator('a:has-text("Xem chi tiết")').first();
    await expect(firstDetailBtn).toBeVisible({ timeout: 10000 });
    await firstDetailBtn.click();

    // 3. Verify vehicle detail page loaded
    await expect(page).toHaveURL(/\/vehicles\/[0-9a-f-]+/);
    await expect(page.locator('#vehicle-detail-title')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#vehicle-owner-name')).toBeVisible();
    await expect(page.locator('#vehicle-amenities-list')).toBeVisible();

    // 4. Verify PricingCalculator widget is loaded
    const calculatorWidget = page.locator('#pricing-calculator-widget');
    await expect(calculatorWidget).toBeVisible();
    await expect(page.locator('#quote-available-badge')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#quote-total-price')).toBeVisible();

    // Initial price should have base rent
    await expect(page.locator('#quote-base-rent')).toBeVisible();

    // 5. Switch Insurance to STANDARD (+100k/day)
    const standardInsuranceBtn = page.locator('#insurance-standard-btn');
    await expect(standardInsuranceBtn).toBeVisible();
    await standardInsuranceBtn.click();

    // Insurance fee appears in breakdown
    const insuranceFeeLine = page.locator('#quote-insurance-fee');
    await expect(insuranceFeeLine).toBeVisible({ timeout: 8000 });
    await expect(insuranceFeeLine).toContainText('200.000');

    // 6. Apply invalid voucher
    const voucherInput = page.locator('#voucher-code-input');
    await voucherInput.fill('INVALID_TEST_CODE');
    await page.locator('#apply-voucher-btn').click();
    await expect(page.locator('#voucher-error-msg')).toBeVisible({ timeout: 8000 });

    // 7. Apply valid voucher WELCOME2026 (10% capped at 200k)
    await voucherInput.fill('WELCOME2026');
    await page.locator('#apply-voucher-btn').click();
    await expect(page.locator('#voucher-success-msg')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#voucher-success-msg')).toContainText('WELCOME2026');

    // Discount appears in breakdown
    const discountLine = page.locator('#quote-discount');
    await expect(discountLine).toBeVisible({ timeout: 8000 });

    // 8. Click "Tiến hành đặt xe" while unauthenticated -> opens AuthModal
    const proceedBtn = page.locator('#proceed-to-book-btn');
    await expect(proceedBtn).toBeVisible();
    await proceedBtn.click();

    await expect(page.locator('#auth-modal-content')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Đăng nhập tài khoản')).toBeVisible();
  });
});
