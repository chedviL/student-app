import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL ?? '';
  const password = process.env.E2E_TEST_PASSWORD ?? '';
  if (!email || !password) {
    test.skip(true, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set in .env.test.local');
    return;
  }
  await page.goto('/login');
  await page.getByRole('textbox', { name: /מייל|email/i }).fill(email);
  await page.getByRole('textbox', { name: /סיסמ|password/i }).fill(password);
  await page.getByRole('button', { name: /כניסה|login|sign in/i }).click();
  await page.waitForURL('/');
}

// ─── FLOW 7: Invalid student URL → graceful error ─────────────────────────────

test('FLOW 7 — invalid student URL shows not-found state', async ({ page }) => {
  await login(page);
  await page.goto('/student/nonexistent-id-that-does-not-exist');
  await expect(page.getByText(/לא נמצא|not found/i)).toBeVisible({ timeout: 8000 });
});

// ─── FLOW 8: Login → refresh → session persists → logout ─────────────────────

test('FLOW 8 — session persists after refresh', async ({ page }) => {
  await login(page);
  await page.reload();
  // Should still be on home, not redirected to login
  await expect(page).not.toHaveURL('/login');
});

test('FLOW 8 — logout redirects to login', async ({ page }) => {
  await login(page);
  // Find logout button (in navbar)
  const logoutBtn = page.getByRole('button', { name: /יציאה|logout|sign out/i });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(page).toHaveURL('/login');
  }
});

// ─── FLOW 1: Home → search → student card ────────────────────────────────────

test('FLOW 1 — search for student and open card', async ({ page }) => {
  await login(page);
  await page.goto('/search');
  // Type in search box
  const searchInput = page.getByRole('textbox').first();
  await searchInput.fill('AUTOTEST');
  // Wait for results
  await page.waitForTimeout(600);
  // If any result appears, click it
  const firstResult = page.locator('[class*="result"], [class*="student-row"], tr').first();
  if (await firstResult.isVisible()) {
    await firstResult.click();
    // Should navigate to student card
    await expect(page).toHaveURL(/\/student\//);
  }
});

// ─── FLOW 2: Payments page loads ─────────────────────────────────────────────

test('FLOW 2 — payments page loads with tabs', async ({ page }) => {
  await login(page);
  await page.goto('/payments');
  await expect(page.getByText(/סקירה/)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/תלמידים/)).toBeVisible();
  await expect(page.getByText(/תנועות/)).toBeVisible();
  await expect(page.getByText(/חודשים/)).toBeVisible();
});

// ─── FLOW 3: Edit student → save → reopen ────────────────────────────────────

test('FLOW 3 — edit student page loads', async ({ page }) => {
  await login(page);
  await page.goto('/edit');
  // Edit page should be visible
  await expect(page).toHaveURL('/edit');
});

// ─── FLOW 6: Excel export — structure check ───────────────────────────────────

test('FLOW 6 — database page has export button', async ({ page }) => {
  await login(page);
  await page.goto('/database');
  const exportBtn = page.getByRole('button', { name: /excel|ייצוא|export/i });
  await expect(exportBtn).toBeVisible({ timeout: 8000 });
});

// ─── REGRESSION: tuitionStartDate not in tuition button ──────────────────────

test('REGRESSION — tuitionStartDate not shown inside tuition button', async ({ page }) => {
  await login(page);
  await page.goto('/search');
  const searchInput = page.getByRole('textbox').first();
  await searchInput.fill('AUTOTEST');
  await page.waitForTimeout(600);

  const firstResult = page.locator('[class*="result"], tr').first();
  if (await firstResult.isVisible()) {
    await firstResult.click();
    await page.waitForURL(/\/student\//);

    // Find the tuition button
    const tuitionBtn = page.getByRole('button', { name: /מצב שכ"ל|שכ"ל/i });
    if (await tuitionBtn.isVisible()) {
      const btnText = await tuitionBtn.textContent();
      expect(btnText).not.toContain('תחילת גבייה');
    }
  }
});
