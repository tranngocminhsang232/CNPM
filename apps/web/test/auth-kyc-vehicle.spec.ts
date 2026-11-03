import { test, expect } from '@playwright/test';

test.describe('Milestone G1 Web Integration Flow (Auth, KYC & Owner Vehicles)', () => {
  test('full end-to-end user lifecycle: login, check KYC profile, switch owner, and view vehicle dashboard', async ({
    page,
  }) => {
    // 1. Visit homepage
    await page.goto('/');
    await expect(page.locator('text=CARSHARE')).toBeVisible();

    // 2. Open login modal
    const loginBtn = page.locator('#nav-login-btn');
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();

    // Modal is opened
    await expect(page.locator('#auth-modal-content')).toBeVisible();
    await expect(page.locator('text=Đăng nhập tài khoản')).toBeVisible();

    // 3. Quick login as renter1
    const renterQuickBtn = page.locator('#quick-login-renter1');
    await expect(renterQuickBtn).toBeVisible();
    await renterQuickBtn.click();

    // Modal closes and UserNav updates with user name and KYC badge
    await expect(page.locator('#nav-user-name')).toHaveText('Thuê 1', { timeout: 10000 });
    await expect(page.locator('#nav-kyc-badge')).toBeVisible();

    // 4. Navigate to KYC profile page
    await page.locator('#user-menu-trigger').click();
    const kycLink = page.locator('#nav-profile-kyc-link');
    await expect(kycLink).toBeVisible();
    await kycLink.click();

    // On /profile/kyc page
    await expect(page).toHaveURL(/\/profile\/kyc/);
    await expect(page.locator('h1')).toContainText('Xác thực Bằng lái xe (KYC)');

    // 5. Logout
    await page.locator('#user-menu-trigger').click();
    const logoutBtn = page.locator('#nav-logout-btn');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Returns to unauthenticated state
    await expect(page.locator('#nav-login-btn')).toBeVisible({ timeout: 10000 });

    // 6. Login as owner1
    await page.locator('#nav-login-btn').click();
    await page.locator('#quick-login-owner1').click();
    await expect(page.locator('#nav-user-name')).toHaveText('Chủ 1', { timeout: 10000 });

    // 7. Navigate to Owner Vehicles management
    await page.locator('#user-menu-trigger').click();
    const ownerVehiclesLink = page.locator('#nav-owner-vehicles-link');
    await expect(ownerVehiclesLink).toBeVisible();
    await ownerVehiclesLink.click();

    // On /owner/vehicles page
    await expect(page).toHaveURL(/\/owner\/vehicles/);
    await expect(page.locator('h1')).toContainText('Danh sách xe cho thuê');
    await expect(page.locator('#owner-add-vehicle-btn')).toBeVisible();
  });
});
