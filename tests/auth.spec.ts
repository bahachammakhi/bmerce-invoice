import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin');
  });

  test('should show login page for unauthenticated users', async ({ page }) => {
    await expect(page).toHaveTitle(/Invoice Manager/);
    await expect(page.locator('[data-slot="card-title"]')).toContainText('Sign In');
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in login form with invalid credentials
    await page.fill('input#email', 'invalid@test.com');
    await page.fill('input#password', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('.text-red-500')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling fields
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('input#email:invalid')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Click logout button (look for various possible logout selectors)
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]').first();
    await logoutButton.click();
    
    // Should redirect to login page
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('[data-slot="card-title"]')).toContainText('Sign In');
  });

  test('should prevent access to protected routes when not authenticated', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('[data-slot="card-title"]')).toContainText('Sign In');
  });

  test('should redirect authenticated users away from login page', async ({ page }) => {
    // Login first
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Try to go back to login page
    await page.goto('/auth/signin');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });
});