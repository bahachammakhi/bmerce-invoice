import { test, expect } from '@playwright/test';

test.describe('Dashboard & Analytics', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth/signin');
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display dashboard overview', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Should show key metrics cards
    await expect(page.locator('[data-testid="total-revenue"], .metric-card, .stat-card')).toBeVisible();
    await expect(page.locator('[data-testid="pending-revenue"], text=Pending')).toBeVisible();
    await expect(page.locator('[data-testid="client-count"], text=Clients')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-count"], text=Invoices')).toBeVisible();
  });

  test('should show revenue statistics', async ({ page }) => {
    // Check for revenue displays
    await expect(page.locator('text=$, text=€, text=د.ت')).toBeVisible();
    
    // Should show different currency amounts
    const revenueElements = page.locator('[data-testid*="revenue"], .revenue, .amount');
    await expect(revenueElements.first()).toBeVisible();
    
    // Should display formatted numbers
    await expect(page.locator('text=/\\$[0-9,]+|€[0-9,]+|د\\.ت[0-9,]+/')).toBeVisible();
  });

  test('should display recent invoices', async ({ page }) => {
    // Look for recent invoices section
    await expect(page.locator('h2:has-text("Recent"), h3:has-text("Recent"), text=Recent Invoices')).toBeVisible();
    
    // Should show invoice details
    await expect(page.locator('[data-testid="recent-invoice"], .recent-invoice, .invoice-item')).toBeVisible();
    
    // Should show invoice statuses
    await expect(page.locator('.status-paid, .status-sent, .status-overdue, text=PAID, text=SENT')).toBeVisible();
  });

  test('should display client statistics', async ({ page }) => {
    // Look for client-related metrics
    await expect(page.locator('text=Top Clients, text=Client, h2:has-text("Client"), h3:has-text("Client")')).toBeVisible();
    
    // Should show client names from seed data
    await expect(page.locator('text=Acme Corporation, text=TechStart Tunisia')).toBeVisible();
  });

  test('should show invoice status distribution', async ({ page }) => {
    // Look for status breakdown
    await expect(page.locator('text=Invoice Status, text=Status Distribution')).toBeVisible();
    
    // Should show different statuses
    await expect(page.locator('text=Draft, text=Sent, text=Paid, text=Overdue')).toBeVisible();
    
    // Should show counts or percentages
    await expect(page.locator('text=/[0-9]+.*%|[0-9]+.*invoices?/')).toBeVisible();
  });

  test('should navigate to other sections from dashboard', async ({ page }) => {
    // Click on clients link/button
    await page.click('a[href="/clients"], button:has-text("View Clients"), text=View All Clients');
    await expect(page).toHaveURL('/clients');
    
    // Go back to dashboard
    await page.click('a[href="/dashboard"], nav a:has-text("Dashboard")');
    await expect(page).toHaveURL('/dashboard');
    
    // Click on invoices link/button
    await page.click('a[href="/invoices"], button:has-text("View Invoices"), text=View All Invoices');
    await expect(page).toHaveURL('/invoices');
  });

  test('should display currency breakdown', async ({ page }) => {
    // Look for multi-currency information
    await expect(page.locator('text=USD, text=EUR, text=TND, text=GBP')).toBeVisible();
    
    // Should show amounts in different currencies
    await expect(page.locator('[data-currency], .currency-amount')).toBeVisible();
  });

  test('should show recent activity', async ({ page }) => {
    // Look for activity feed or recent actions
    const activitySection = page.locator('text=Recent Activity, text=Activity Feed, h2:has-text("Activity"), h3:has-text("Activity")');
    
    if (await activitySection.isVisible()) {
      // Should show activity items
      await expect(page.locator('[data-testid="activity-item"], .activity-item')).toBeVisible();
      
      // Should show timestamps
      await expect(page.locator('text=/[0-9]+ (minutes?|hours?|days?) ago|[0-9]{1,2}\/[0-9]{1,2}/')).toBeVisible();
    }
  });

  test('should refresh data', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.locator('button:has-text("Refresh"), [data-testid="refresh"], button[aria-label="Refresh"]');
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Should show loading state or updated data
      await expect(page.locator('.loading, [data-loading="true"], text=Loading')).toBeVisible({ timeout: 1000 });
    }
  });

  test('should handle empty states', async ({ page }) => {
    // This test might not apply if we have seed data, but we can check error handling
    
    // Check if there are any error messages
    const errorMessages = page.locator('[role="alert"], .error, .text-red-500');
    
    if (await errorMessages.isVisible()) {
      // Should show helpful error messages
      await expect(errorMessages).toContainText(/error|failed|unable/i);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Dashboard should still be accessible
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Metrics should be visible (might be stacked)
    await expect(page.locator('[data-testid="total-revenue"], .metric-card, .stat-card')).toBeVisible();
    
    // Navigation should work
    const mobileMenu = page.locator('button[aria-label="Menu"], .mobile-menu-button, .hamburger');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('nav, .mobile-nav')).toBeVisible();
    }
  });

  test('should show analytics charts if available', async ({ page }) => {
    // Look for chart containers
    const charts = page.locator('.chart, .graph, canvas, svg[class*="chart"]');
    
    if (await charts.isVisible()) {
      // Should have chart elements
      await expect(charts.first()).toBeVisible();
      
      // Charts should have data (check for chart libraries)
      await expect(page.locator('.recharts, .chartjs, .d3')).toBeVisible();
    }
  });

  test('should filter data by date range', async ({ page }) => {
    // Look for date range picker
    const dateFilter = page.locator('input[type="date"], .date-picker, [data-testid="date-filter"]');
    
    if (await dateFilter.isVisible()) {
      // Should be able to select date range
      const today = new Date().toISOString().split('T')[0];
      await dateFilter.first().fill(today);
      
      // Data should update (check for loading or change in numbers)
      await page.waitForTimeout(500); // Brief wait for updates
    }
  });
});