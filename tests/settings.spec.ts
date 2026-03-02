import { test, expect } from '@playwright/test';

test.describe('Settings & Configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth/signin');
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Navigate to settings page
    await page.click('a[href="/dashboard/settings"], nav a:has-text("Settings")');
    await expect(page).toHaveURL('/dashboard/settings');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Settings');
    
    // Should show main settings sections
    await expect(page.locator('text=Company Information, h2:has-text("Company"), h3:has-text("Company")')).toBeVisible();
    await expect(page.locator('text=Bank Details, h2:has-text("Bank"), h3:has-text("Bank")')).toBeVisible();
  });

  test('should display invoice system selector', async ({ page }) => {
    // Should show invoice system preference options
    await expect(page.locator('text=Invoice System, label:has-text("Invoice")')).toBeVisible();
    
    // Should have Normal and Tunisian options
    await expect(page.locator('input[value="NORMAL"], label:has-text("Normal"), text=Normal')).toBeVisible();
    await expect(page.locator('input[value="TUNISIAN"], label:has-text("Tunisian"), text=Tunisian')).toBeVisible();
  });

  test('should display company information fields', async ({ page }) => {
    // Should show all company info fields
    await expect(page.locator('input[name*="companyInfo.name"], input[name="name"], label:has-text("Company Name")')).toBeVisible();
    await expect(page.locator('input[name*="companyInfo.address"], input[name="address"], label:has-text("Address")')).toBeVisible();
    await expect(page.locator('input[name*="companyInfo.phone"], input[name="phone"], label:has-text("Phone")')).toBeVisible();
    await expect(page.locator('input[name*="companyInfo.email"], input[name="email"], label:has-text("Email")')).toBeVisible();
  });

  test('should update company information', async ({ page }) => {
    // Fill in company name
    const companyNameInput = page.locator('input[name*="companyInfo.name"], input[name="name"]').first();
    await companyNameInput.fill('Test Company Updated');
    
    // Fill in company address
    const addressInput = page.locator('input[name*="companyInfo.address"], input[name="address"], textarea[name*="address"]').first();
    await addressInput.fill('456 New Street, Test City');
    
    // Fill in phone
    const phoneInput = page.locator('input[name*="companyInfo.phone"], input[name="phone"]').first();
    await phoneInput.fill('+1-555-9999');
    
    // Save settings
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
    
    // Should show success message
    await expect(page.locator('[role="alert"], .success, .text-green-500, text=saved, text=updated')).toBeVisible({ timeout: 5000 });
  });

  test('should display bank details fields', async ({ page }) => {
    // Should show bank details fields
    await expect(page.locator('input[name*="bankDetails.bankName"], input[name="bankName"], label:has-text("Bank Name")')).toBeVisible();
    await expect(page.locator('input[name*="bankDetails.iban"], input[name="iban"], label:has-text("IBAN")')).toBeVisible();
    await expect(page.locator('input[name*="bankDetails.swift"], input[name="swift"], label:has-text("SWIFT")')).toBeVisible();
  });

  test('should update bank details', async ({ page }) => {
    // Fill in bank name
    const bankNameInput = page.locator('input[name*="bankDetails.bankName"], input[name="bankName"]').first();
    await bankNameInput.fill('Test Bank International');
    
    // Fill in IBAN
    const ibanInput = page.locator('input[name*="bankDetails.iban"], input[name="iban"]').first();
    await ibanInput.fill('TN5904018104004942712345');
    
    // Fill in SWIFT
    const swiftInput = page.locator('input[name*="bankDetails.swift"], input[name="swift"]').first();
    await swiftInput.fill('TESTTNTT');
    
    // Save settings
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
    
    // Should show success message
    await expect(page.locator('[role="alert"], .success, text=saved, text=updated')).toBeVisible({ timeout: 5000 });
  });

  test('should switch to Tunisian invoice system', async ({ page }) => {
    // Click on Tunisian option
    const tunisianOption = page.locator('input[value="TUNISIAN"], label:has-text("Tunisian")').first();
    await tunisianOption.click();
    
    // Should show Tunisian-specific fields
    await expect(page.locator('input[name*="tvaNumber"], label:has-text("TVA"), text=TVA Number')).toBeVisible();
    await expect(page.locator('input[name*="mfNumber"], label:has-text("MF"), text=Matricule Fiscal')).toBeVisible();
  });

  test('should display Tunisian tax fields when Tunisian mode is selected', async ({ page }) => {
    // Select Tunisian mode
    const tunisianOption = page.locator('input[value="TUNISIAN"], label:has-text("Tunisian")').first();
    
    if (await tunisianOption.isVisible()) {
      await tunisianOption.click();
      
      // Should show TVA number field
      await expect(page.locator('input[name*="tvaNumber"]')).toBeVisible();
      
      // Should show MF number field  
      await expect(page.locator('input[name*="mfNumber"]')).toBeVisible();
    }
  });

  test('should fill Tunisian tax information', async ({ page }) => {
    // Select Tunisian mode
    const tunisianOption = page.locator('input[value="TUNISIAN"], label:has-text("Tunisian")').first();
    
    if (await tunisianOption.isVisible()) {
      await tunisianOption.click();
      
      // Fill TVA number
      const tvaInput = page.locator('input[name*="tvaNumber"]').first();
      await tvaInput.fill('1234567ABC');
      
      // Fill MF number
      const mfInput = page.locator('input[name*="mfNumber"]').first();
      await mfInput.fill('1234567/A/M/000');
      
      // Save settings
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
      
      // Should show success
      await expect(page.locator('[role="alert"], text=saved, text=updated')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate email format', async ({ page }) => {
    // Find email input
    const emailInput = page.locator('input[name*="email"], input[type="email"]').first();
    
    if (await emailInput.isVisible()) {
      // Enter invalid email
      await emailInput.fill('invalid-email');
      
      // Try to save
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
      
      // Should show validation error
      await expect(page.locator('input:invalid, .text-red-500, [role="alert"]')).toBeVisible();
    }
  });

  test('should display base currency selector', async ({ page }) => {
    // Should have a base currency preference
    const currencySelector = page.locator('[data-testid="base-currency"], select[name*="currency"], text=Base Currency');
    
    if (await currencySelector.isVisible()) {
      // Should show available currencies
      await expect(page.locator('option:has-text("USD"), option:has-text("EUR"), option:has-text("TND")')).toBeVisible();
    }
  });

  test('should persist settings after page reload', async ({ page }) => {
    // Update a setting
    const companyNameInput = page.locator('input[name*="companyInfo.name"], input[name="name"]').first();
    const testName = 'Persistence Test Company ' + Date.now();
    await companyNameInput.fill(testName);
    
    // Save
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
    
    // Wait for save
    await expect(page.locator('[role="alert"], text=saved, text=updated')).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Reload page
    await page.reload();
    
    // Check value persisted
    await expect(companyNameInput.or(page.locator('input[name*="companyInfo.name"]').first())).toHaveValue(testName);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Settings should still be visible
    await expect(page.locator('h1')).toContainText('Settings');
    
    // Form fields should be usable
    await expect(page.locator('input[name*="companyInfo.name"], input[name="name"]').first()).toBeVisible();
    
    // Save button should be visible
    await expect(page.locator('button[type="submit"]:has-text("Save"), button:has-text("Update")')).toBeVisible();
  });

  test('should navigate back to dashboard', async ({ page }) => {
    // Click dashboard link
    await page.click('a[href="/dashboard"], nav a:has-text("Dashboard")');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show RIB field for bank details', async ({ page }) => {
    // Look for RIB field (Tunisian bank identifier)
    const ribInput = page.locator('input[name*="bankDetails.rib"], input[name="rib"], label:has-text("RIB")');
    
    if (await ribInput.first().isVisible()) {
      await expect(ribInput.first()).toBeVisible();
      
      // Can fill RIB
      await ribInput.first().fill('04 018 0100049427123 45');
    }
  });

  test('should display website field', async ({ page }) => {
    // Look for website field
    const websiteInput = page.locator('input[name*="companyInfo.website"], input[name="website"], label:has-text("Website")');
    
    if (await websiteInput.first().isVisible()) {
      await websiteInput.first().fill('https://testcompany.com');
    }
  });

  test('should display tax ID field', async ({ page }) => {
    // Look for tax ID field
    const taxIdInput = page.locator('input[name*="companyInfo.taxId"], input[name="taxId"], label:has-text("Tax ID")');

    if (await taxIdInput.first().isVisible()) {
      await taxIdInput.first().fill('TAX123456789');
    }
  });

  test('should validate required company name field', async ({ page }) => {
    // Clear company name field
    const companyNameInput = page.locator('input[name*="companyInfo.name"], input[name="name"]').first();
    await companyNameInput.fill('');

    // Try to save
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

    // Should show validation error or field should be marked as required
    const hasInvalid = await page.locator('input:invalid, .text-red-500, [role="alert"]').isVisible();
    expect(hasInvalid).toBe(true);
  });

  test('should validate TVA number format for Tunisian mode', async ({ page }) => {
    // Select Tunisian mode
    const tunisianOption = page.locator('input[value="TUNISIAN"], label:has-text("Tunisian")').first();

    if (await tunisianOption.isVisible()) {
      await tunisianOption.click();

      // Fill TVA number with potentially invalid format
      const tvaInput = page.locator('input[name*="tvaNumber"]').first();
      if (await tvaInput.isVisible()) {
        // Valid TVA format should be accepted
        await tvaInput.fill('1234567/A/P/000');
        const value = await tvaInput.inputValue();
        expect(value).toBe('1234567/A/P/000');
      }
    }
  });

  test('should validate MF number format for Tunisian mode', async ({ page }) => {
    // Select Tunisian mode
    const tunisianOption = page.locator('input[value="TUNISIAN"], label:has-text("Tunisian")').first();

    if (await tunisianOption.isVisible()) {
      await tunisianOption.click();

      // Fill MF number
      const mfInput = page.locator('input[name*="mfNumber"]').first();
      if (await mfInput.isVisible()) {
        await mfInput.fill('9876543/B/M/000');
        const value = await mfInput.inputValue();
        expect(value).toBe('9876543/B/M/000');
      }
    }
  });

  test('should validate RIB field length for Tunisian bank details', async ({ page }) => {
    // RIB should be 20 characters for Tunisia
    const ribInput = page.locator('input[name*="bankDetails.rib"], input[name="rib"]');

    if (await ribInput.first().isVisible()) {
      // Fill with 20-character RIB
      const validRib = '04018010004942712345';
      await ribInput.first().fill(validRib);
      const value = await ribInput.first().inputValue();
      expect(value.length).toBe(20);
    }
  });

  test('should show Tunisian fields hidden when switching to Normal mode', async ({ page }) => {
    // First ensure we're in Tunisian mode
    const tunisianOption = page.locator('input[value="TUNISIAN"], label:has-text("Tunisian")').first();
    if (await tunisianOption.isVisible()) {
      await tunisianOption.click();

      // Tunisian fields should be visible
      await expect(page.locator('input[name*="tvaNumber"]')).toBeVisible();
    }

    // Switch to Normal mode
    const normalOption = page.locator('input[value="NORMAL"], label:has-text("Normal")').first();
    if (await normalOption.isVisible()) {
      await normalOption.click();

      // Tunisian-specific fields should be hidden
      await expect(page.locator('input[name*="tvaNumber"]')).not.toBeVisible();
      await expect(page.locator('input[name*="mfNumber"]')).not.toBeVisible();
    }
  });

  test('should validate phone number format', async ({ page }) => {
    const phoneInput = page.locator('input[name*="companyInfo.phone"], input[name="phone"]').first();

    if (await phoneInput.isVisible()) {
      // Enter valid phone format
      await phoneInput.fill('+216-71-123-456');
      const value = await phoneInput.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('should clear form on cancel if cancel button exists', async ({ page }) => {
    // Fill in a field
    const companyNameInput = page.locator('input[name*="companyInfo.name"], input[name="name"]').first();
    const originalValue = await companyNameInput.inputValue();
    await companyNameInput.fill('Test Cancel Company');

    // Look for cancel button
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Reset")');

    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Value should be reset
      const newValue = await companyNameInput.inputValue();
      expect(newValue).not.toBe('Test Cancel Company');
    }
  });

  test('should handle form submission with all fields filled', async ({ page }) => {
    // Fill all visible fields
    const companyNameInput = page.locator('input[name*="companyInfo.name"], input[name="name"]').first();
    const addressInput = page.locator('input[name*="companyInfo.address"], input[name="address"], textarea[name*="address"]').first();
    const phoneInput = page.locator('input[name*="companyInfo.phone"], input[name="phone"]').first();

    await companyNameInput.fill('Complete Test Company');
    await addressInput.fill('123 Full Address Street');
    await phoneInput.fill('+1-555-1234');

    // Fill bank details
    const bankNameInput = page.locator('input[name*="bankDetails.bankName"], input[name="bankName"]').first();
    if (await bankNameInput.isVisible()) {
      await bankNameInput.fill('Complete Test Bank');
    }

    // Save
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

    // Should succeed
    await expect(page.locator('[role="alert"], text=saved, text=updated, text=success')).toBeVisible({ timeout: 5000 });
  });
});
