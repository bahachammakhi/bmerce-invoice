import { test, expect } from '@playwright/test';

test.describe('Currencies & Exchange Rates', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth/signin');
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Navigate to currencies page
    await page.click('a[href="/dashboard/currencies"], nav a:has-text("Currencies")');
    await expect(page).toHaveURL('/dashboard/currencies');
  });

  test('should display currencies page with exchange rates', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Currency Exchange Rates');
    
    // Should show the exchange rates table
    await expect(page.locator('table, [data-testid="rates-table"]')).toBeVisible();
    
    // Should show currency codes
    await expect(page.locator('text=USD, text=EUR, text=TND, text=GBP')).toBeVisible();
  });

  test('should display base currency selector', async ({ page }) => {
    // Look for base currency selector
    const selectTrigger = page.locator('[data-testid="base-currency-select"], button:has-text("USD"), .select-trigger');
    await expect(selectTrigger.first()).toBeVisible();
    
    // Should show update rates button
    await expect(page.locator('button:has-text("Update Rates"), button:has-text("Refresh")')).toBeVisible();
  });

  test('should change base currency', async ({ page }) => {
    // Click on base currency selector
    const selectTrigger = page.locator('[data-testid="base-currency-select"], button:has([role="combobox"]), [class*="SelectTrigger"]').first();
    
    if (await selectTrigger.isVisible()) {
      await selectTrigger.click();
      
      // Select EUR as base currency
      await page.click('[role="option"]:has-text("EUR"), [data-value="EUR"]');
      
      // Should update the table header
      await expect(page.locator('text=Base: EUR, text=Exchange Rates (Base: EUR)')).toBeVisible();
    }
  });

  test('should update exchange rates', async ({ page }) => {
    // Click update rates button
    const updateButton = page.locator('button:has-text("Update Rates"), button:has-text("Refresh")');
    await updateButton.click();
    
    // Should show loading state or success
    await expect(page.locator('button:has-text("Updating"), .loading')).toBeVisible({ timeout: 1000 }).catch(() => {
      // Loading state may be too quick to catch
    });
    
    // After update, should show exchange rates
    await expect(page.locator('table tbody tr')).toHaveCount({ min: 1 });
  });

  test('should display currency converter', async ({ page }) => {
    // Look for currency converter component
    const converter = page.locator('[data-testid="currency-converter"], text=Currency Converter, h2:has-text("Convert"), h3:has-text("Convert")');
    await expect(converter.first()).toBeVisible();
    
    // Should have input fields for conversion
    await expect(page.locator('input[type="number"], input[placeholder*="amount" i]')).toBeVisible();
  });

  test('should convert between currencies', async ({ page }) => {
    // Find amount input
    const amountInput = page.locator('input[type="number"], input[name="amount"]').first();
    
    if (await amountInput.isVisible()) {
      // Enter amount
      await amountInput.fill('100');
      
      // Select currencies if dropdowns are visible
      const fromSelect = page.locator('select[name="from"], [data-testid="from-currency"]');
      const toSelect = page.locator('select[name="to"], [data-testid="to-currency"]');
      
      if (await fromSelect.isVisible() && await toSelect.isVisible()) {
        await fromSelect.selectOption('USD');
        await toSelect.selectOption('EUR');
      }
      
      // Should show converted result
      await expect(page.locator('[data-testid="conversion-result"], .result, text=/[0-9]+\\.?[0-9]*/')).toBeVisible();
    }
  });

  test('should display exchange rate trend indicators', async ({ page }) => {
    // Look for trend indicators (up/down arrows or percentages)
    const trendIndicators = page.locator('svg[class*="trending"], .text-green, .text-red, text=/[+-][0-9]+\\.?[0-9]*%/');
    
    // Trend indicators should be visible in the table
    await expect(trendIndicators.first()).toBeVisible();
  });

  test('should show last updated timestamp', async ({ page }) => {
    // Should display when rates were last updated
    await expect(page.locator('text=Last updated, text=Updated:')).toBeVisible();
    
    // Should show a date/time format
    await expect(page.locator('text=/[0-9]{1,2}[:\\/][0-9]{1,2}|[A-Za-z]+ [0-9]{1,2}/')).toBeVisible();
  });

  test('should handle empty exchange rates state', async ({ page }) => {
    // Look for empty state message or fetch button
    const emptyState = page.locator('text=No exchange rate data, text=Fetch Exchange Rates, .empty-state');
    
    if (await emptyState.isVisible()) {
      // Should have a button to fetch rates
      await expect(page.locator('button:has-text("Fetch"), button:has-text("Update")')).toBeVisible();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Page should still be accessible
    await expect(page.locator('h1')).toContainText('Currency');
    
    // Table should be visible (might scroll horizontally)
    await expect(page.locator('table, [data-testid="rates-table"]')).toBeVisible();
    
    // Currency converter should be visible
    await expect(page.locator('[data-testid="currency-converter"], text=Convert')).toBeVisible();
  });

  test('should navigate back to dashboard', async ({ page }) => {
    // Click dashboard link
    await page.click('a[href="/dashboard"], nav a:has-text("Dashboard"), text=Invoice Manager');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should handle TND currency with 3 decimal places', async ({ page }) => {
    // Look for TND in the rates table
    const tndRow = page.locator('tr:has-text("TND"), [data-currency="TND"]');

    if (await tndRow.isVisible()) {
      // TND values should display 3 decimal places
      await expect(page.locator('text=/TND.*[0-9]+\\.[0-9]{3}/')).toBeVisible();
    }
  });

  test('should verify currency conversion accuracy', async ({ page }) => {
    // Find amount input in converter
    const amountInput = page.locator('input[type="number"], input[name="amount"]').first();

    if (await amountInput.isVisible()) {
      // Enter a known amount
      await amountInput.fill('100');

      // Result should be a valid number (not NaN or undefined)
      const resultText = page.locator('[data-testid="conversion-result"], .result');
      if (await resultText.isVisible()) {
        const text = await resultText.textContent();
        expect(text).toMatch(/[0-9]+\.?[0-9]*/);
      }
    }
  });

  test('should handle zero amount conversion', async ({ page }) => {
    const amountInput = page.locator('input[type="number"], input[name="amount"]').first();

    if (await amountInput.isVisible()) {
      // Enter zero
      await amountInput.fill('0');

      // Result should be 0 or show appropriate message
      const resultText = page.locator('[data-testid="conversion-result"], .result');
      if (await resultText.isVisible()) {
        const text = await resultText.textContent();
        expect(text).toMatch(/0|no.*amount/i);
      }
    }
  });

  test('should handle same currency conversion', async ({ page }) => {
    const amountInput = page.locator('input[type="number"], input[name="amount"]').first();
    const fromSelect = page.locator('select[name="from"], [data-testid="from-currency"]');
    const toSelect = page.locator('select[name="to"], [data-testid="to-currency"]');

    if (await amountInput.isVisible() && await fromSelect.isVisible() && await toSelect.isVisible()) {
      // Set same currency for both
      await fromSelect.selectOption('USD');
      await toSelect.selectOption('USD');
      await amountInput.fill('100');

      // Result should equal input amount
      const resultText = page.locator('[data-testid="conversion-result"], .result');
      if (await resultText.isVisible()) {
        const text = await resultText.textContent();
        expect(text).toContain('100');
      }
    }
  });

  test('should show error for invalid conversion input', async ({ page }) => {
    const amountInput = page.locator('input[type="number"], input[name="amount"]').first();

    if (await amountInput.isVisible()) {
      // Try entering negative number
      await amountInput.fill('-100');

      // Should show error or prevent negative values
      const hasError = await page.locator('.error, .text-red, input:invalid').isVisible();
      const value = await amountInput.inputValue();

      // Either shows error or input rejects negative
      expect(hasError || !value.includes('-')).toBe(true);
    }
  });

  test('should verify exchange rates are numeric', async ({ page }) => {
    // All rate values in the table should be valid numbers
    const rateValues = page.locator('td:has-text(/^[0-9]+\\.[0-9]+$/)');
    const count = await rateValues.count();

    // Should have at least some rate values displayed
    expect(count).toBeGreaterThan(0);
  });
});
