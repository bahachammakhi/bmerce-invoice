import { test, expect } from '@playwright/test';

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth/signin');
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Navigate to invoices page
    await page.click('a[href="/invoices"], nav a:has-text("Invoices")');
    await expect(page).toHaveURL('/invoices');
  });

  test('should display invoices list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Invoices');
    
    // Should show the "Create Invoice" button
    await expect(page.locator('button:has-text("Create Invoice"), a:has-text("Create Invoice"), button:has-text("New Invoice")')).toBeVisible();
    
    // Should show existing invoices from seed data
    await expect(page.locator('td:has-text("PAID"), .status-paid')).toBeVisible();
    await expect(page.locator('td:has-text("SENT"), .status-sent')).toBeVisible();
    await expect(page.locator('td:has-text("OVERDUE"), .status-overdue')).toBeVisible();
  });

  test('should open create invoice form', async ({ page }) => {
    await page.click('button:has-text("Create Invoice"), a:has-text("Create Invoice"), button:has-text("New Invoice")');
    
    // Should show the form fields
    await expect(page.locator('select[name="clientId"], [data-testid="client-select"]')).toBeVisible();
    await expect(page.locator('select[name="currencyId"], [data-testid="currency-select"]')).toBeVisible();
    await expect(page.locator('input[name="issueDate"], input[type="date"]')).toBeVisible();
    await expect(page.locator('input[name="dueDate"]')).toBeVisible();
  });

  test('should create a new invoice', async ({ page }) => {
    await page.click('button:has-text("Create Invoice"), a:has-text("Create Invoice"), button:has-text("New Invoice")');
    
    // Select client (first option)
    await page.selectOption('select[name="clientId"], [data-testid="client-select"]', { index: 1 });
    
    // Select currency (USD)
    await page.selectOption('select[name="currencyId"], [data-testid="currency-select"]', { index: 1 });
    
    // Set dates
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    await page.fill('input[name="issueDate"], input[type="date"]', today);
    await page.fill('input[name="dueDate"]', futureDate);
    
    // Add invoice items
    await page.fill('input[name="items.0.description"], [data-testid="item-description"]', 'Test Service');
    await page.fill('input[name="items.0.quantity"], [data-testid="item-quantity"]', '10');
    await page.fill('input[name="items.0.unitPrice"], [data-testid="item-price"]', '100');
    await page.fill('input[name="items.0.taxRate"], [data-testid="item-tax"]', '10');
    
    // Add notes
    await page.fill('textarea[name="notes"], [data-testid="invoice-notes"]', 'Test invoice created by automation');
    
    // Submit the form
    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save Invoice")');
    
    // Should redirect back to invoices list
    await expect(page).toHaveURL('/invoices');
    
    // Should show the new invoice
    await expect(page.locator('td:has-text("Test Service"), text=Test Service')).toBeVisible();
  });

  test('should add multiple invoice items', async ({ page }) => {
    await page.click('button:has-text("Create Invoice"), a:has-text("Create Invoice"), button:has-text("New Invoice")');
    
    // Select client and currency
    await page.selectOption('select[name="clientId"], [data-testid="client-select"]', { index: 1 });
    await page.selectOption('select[name="currencyId"], [data-testid="currency-select"]', { index: 1 });
    
    // Add first item
    await page.fill('input[name="items.0.description"], [data-testid="item-description"]', 'Service 1');
    await page.fill('input[name="items.0.quantity"], [data-testid="item-quantity"]', '5');
    await page.fill('input[name="items.0.unitPrice"], [data-testid="item-price"]', '200');
    
    // Add second item
    await page.click('button:has-text("Add Item"), [data-testid="add-item"]');
    await page.fill('input[name="items.1.description"]', 'Service 2');
    await page.fill('input[name="items.1.quantity"]', '3');
    await page.fill('input[name="items.1.unitPrice"]', '150');
    
    // Should calculate totals automatically
    await expect(page.locator('[data-testid="subtotal"], .subtotal')).toContainText('1450'); // 5*200 + 3*150
  });

  test('should update invoice status', async ({ page }) => {
    // Click on first invoice to view details
    await page.click('tr:has(td):first-of-type, [data-testid="invoice-row"]:first-of-type');
    
    // Should show invoice details
    await expect(page.locator('h1, h2')).toContainText(/Invoice|INV-/);
    
    // Update status
    await page.selectOption('select[name="status"], [data-testid="status-select"]', 'PAID');
    
    // Save changes
    await page.click('button:has-text("Save"), button:has-text("Update")');
    
    // Should show success message
    await expect(page.locator('[role="alert"], .success, .text-green-500')).toBeVisible();
  });

  test('should generate PDF', async ({ page }) => {
    // Click on first invoice
    await page.click('tr:has(td):first-of-type, [data-testid="invoice-row"]:first-of-type');
    
    // Click PDF download button
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download PDF"), [data-testid="download-pdf"]');
    
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/invoice.*\.pdf/i);
  });

  test('should send invoice via email', async ({ page }) => {
    // Click on first invoice
    await page.click('tr:has(td):first-of-type, [data-testid="invoice-row"]:first-of-type');
    
    // Click send email button
    await page.click('button:has-text("Send Email"), [data-testid="send-email"]');
    
    // Should show email form or success message
    await expect(page.locator('[role="dialog"], .modal, [role="alert"]')).toBeVisible();
    
    if (await page.locator('input[name="to"], input[type="email"]').isVisible()) {
      // Fill email form if shown
      await page.fill('input[name="to"], input[type="email"]', 'test@example.com');
      await page.click('button:has-text("Send"), button[type="submit"]');
    }
    
    // Should show success message
    await expect(page.locator('text=sent, text=email')).toBeVisible();
  });

  test('should filter invoices by status', async ({ page }) => {
    // Look for status filter
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');
    
    if (await statusFilter.isVisible()) {
      // Filter by PAID status
      await statusFilter.selectOption('PAID');
      
      // Should show only paid invoices
      await expect(page.locator('td:has-text("PAID"), .status-paid')).toBeVisible();
      await expect(page.locator('td:has-text("DRAFT"), .status-draft')).not.toBeVisible();
      
      // Reset filter
      await statusFilter.selectOption('ALL');
      
      // Should show all invoices again
      await expect(page.locator('td:has-text("DRAFT"), .status-draft')).toBeVisible();
    }
  });

  test('should search invoices', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"], input[name="search"]');
    
    if (await searchInput.isVisible()) {
      // Search for specific invoice content
      await searchInput.fill('Web Development');
      
      // Should show matching invoices only
      await expect(page.locator('td:has-text("Web Development"), text=Web Development')).toBeVisible();
      
      // Clear search
      await searchInput.fill('');
    }
  });

  test('should validate required fields when creating invoice', async ({ page }) => {
    await page.click('button:has-text("Create Invoice"), a:has-text("Create Invoice"), button:has-text("New Invoice")');
    
    // Try to submit without required fields
    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save Invoice")');
    
    // Should show validation errors
    await expect(page.locator('select[name="clientId"]:invalid, select[name="clientId"][aria-invalid="true"]')).toBeVisible();
  });

  test('should delete an invoice', async ({ page }) => {
    // Click on delete button for first invoice
    await page.click('button:has-text("Delete"):first-of-type, [data-testid="delete-invoice"]:first-of-type');
    
    // Should show confirmation dialog
    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
    await expect(page.locator('text=confirm, text=delete')).toBeVisible();
    
    // Confirm deletion
    await page.click('button:has-text("Delete"), button:has-text("Confirm")');
    
    // Should show success message
    await expect(page.locator('[role="alert"], .success')).toBeVisible();
  });

  test('should handle multi-currency invoices', async ({ page }) => {
    await page.click('button:has-text("Create Invoice"), a:has-text("Create Invoice"), button:has-text("New Invoice")');
    
    // Select TND currency
    await page.selectOption('select[name="currencyId"], [data-testid="currency-select"]', 'TND');
    
    // Should show TND symbol in price displays
    await expect(page.locator('text=د.ت, [data-currency="TND"]')).toBeVisible();
    
    // Change to EUR
    await page.selectOption('select[name="currencyId"], [data-testid="currency-select"]', 'EUR');
    
    // Should show EUR symbol
    await expect(page.locator('text=€, [data-currency="EUR"]')).toBeVisible();
  });

  test('should show invoice with custom fields for Tunisia', async ({ page }) => {
    // Look for Tunisian invoice (TechStart Tunisia client)
    await page.click('td:has-text("TechStart"), tr:has(td:has-text("TND"))');
    
    // Should show Tunisian custom fields
    await expect(page.locator('text=Customs Code, text=Fiscal Stamp')).toBeVisible();
  });
});