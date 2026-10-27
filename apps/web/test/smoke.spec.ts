import { test, expect } from '@playwright/test';

test.describe('Car Sharing Web Smoke Test', () => {
  test('should load homepage and display vehicles from real PostgreSQL seed via NestJS API', async ({
    page,
  }) => {
    // Navigate to homepage
    await page.goto('/');

    // 1. Verify branding and header
    await expect(page.locator('text=CARSHARE')).toBeVisible();
    await expect(page.locator('text=Hệ thống trực tuyến')).toBeVisible();

    // 2. Verify vehicles grid is rendered with real seed data
    const grid = page.locator('[data-testid="vehicles-grid"]');
    await expect(grid).toBeVisible({ timeout: 10000 });

    const vehicleCards = page.locator('[data-testid="vehicle-card"]');
    const cardCount = await vehicleCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify first card displays price with VND unit and no sensitive private data
    const firstCard = vehicleCards.first();
    await expect(firstCard).toContainText('₫/ngày');

    // Confirm privacy: license plate and exact street address are NEVER exposed
    const content = await page.content();
    expect(content).not.toContain('51H-99999');
    expect(content).not.toContain('29A-88888');
    expect(content).not.toContain('pickupAddress');

    // 3. Test interactive filtering by City
    const citySelect = page.locator('[data-testid="city-select"]');
    await citySelect.selectOption('Hà Nội');

    // Total count or cards should reflect Hà Nội vehicles
    await expect(page.locator('[data-testid="total-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="reset-filter-btn"]')).toBeVisible();

    // 4. Test Keyless filter toggle
    const keylessCheckbox = page.locator('[data-testid="keyless-checkbox"]');
    await keylessCheckbox.check();

    // Verify keyless badge is displayed on filtered cards
    const keylessBadge = page.locator('[data-testid="keyless-badge"]').first();
    await expect(keylessBadge).toBeVisible();

    // 5. Test Reset filters button
    await page.locator('[data-testid="reset-filter-btn"]').click();
    await expect(citySelect).toHaveValue('ALL');
    await expect(keylessCheckbox).not.toBeChecked();
  });
});
