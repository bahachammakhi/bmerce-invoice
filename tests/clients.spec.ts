import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth/signin');
    await page.fill('input#email', 'admin@invoice.test');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Navigate to clients page
    await page.click('a[href="/dashboard/clients"], nav a:has-text("Clients")');
    await expect(page).toHaveURL('/dashboard/clients');
  });

  test('should display clients list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Clients');
    
    // Should show the "Add Client" button
    await expect(page.locator('button:has-text("Add Client"), a:has-text("Add Client")')).toBeVisible();
    
    // Should show existing clients from seed data
    await expect(page.locator('text=Acme Corporation')).toBeVisible();
    await expect(page.locator('text=TechStart Tunisia')).toBeVisible();
  });

  test('should open add client form', async ({ page }) => {
    await page.click('button:has-text("Add Client"), a:has-text("Add Client")');
    
    // Should show the form fields
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    await expect(page.locator('input[name="address"]')).toBeVisible();
    await expect(page.locator('input[name="city"]')).toBeVisible();
    await expect(page.locator('input[name="country"]')).toBeVisible();
  });

  test('should create a new client', async ({ page }) => {
    await page.click('button:has-text("Add Client"), a:has-text("Add Client")');
    
    // Fill out the form
    await page.fill('input[name="name"]', 'Test Client Company');
    await page.fill('input[name="email"]', 'test@company.com');
    await page.fill('input[name="phone"]', '+1-555-0100');
    await page.fill('input[name="address"]', '123 Test Street');
    await page.fill('input[name="city"]', 'Test City');
    await page.fill('input[name="postalCode"]', '12345');
    await page.selectOption('select[name="country"]', 'US');
    await page.fill('input[name="taxId"]', 'TEST123456789');
    
    // Submit the form
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Create")');
    
    // Should redirect back to clients list
    await expect(page).toHaveURL('/dashboard/clients');
    
    // Should show success message and new client
    await expect(page.locator('text=Test Client Company')).toBeVisible();
  });

  test('should validate required fields when creating client', async ({ page }) => {
    await page.click('button:has-text("Add Client"), a:has-text("Add Client")');
    
    // Try to submit without required fields
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Create")');
    
    // Should show validation errors
    await expect(page.locator('input[name="name"]:invalid, input[name="name"][aria-invalid="true"]')).toBeVisible();
  });

  test('should edit an existing client', async ({ page }) => {
    // Click on edit button for first client
    await page.click('button:has-text("Edit"):first-of-type, a:has-text("Edit"):first-of-type, [data-testid="edit-client"]:first-of-type');
    
    // Should show edit form with pre-filled data
    await expect(page.locator('input[name="name"]')).toHaveValue('Acme Corporation');
    
    // Update the name
    await page.fill('input[name="name"]', 'Acme Corporation Updated');
    
    // Submit the form
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
    
    // Should redirect back to clients list
    await expect(page).toHaveURL('/dashboard/clients');
    
    // Should show updated client name
    await expect(page.locator('text=Acme Corporation Updated')).toBeVisible();
  });

  test('should delete a client', async ({ page }) => {
    // Click on delete button for a client
    await page.click('button:has-text("Delete"):first-of-type, [data-testid="delete-client"]:first-of-type');
    
    // Should show confirmation dialog
    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
    await expect(page.locator('text=confirm, text=delete')).toBeVisible();
    
    // Confirm deletion
    await page.click('button:has-text("Delete"), button:has-text("Confirm")');
    
    // Client should be removed from the list
    await expect(page.locator('text=Acme Corporation')).not.toBeVisible();
  });

  test('should search clients', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"], input[name="search"]');
    
    if (await searchInput.isVisible()) {
      // Search for a specific client
      await searchInput.fill('TechStart');
      
      // Should show only matching clients
      await expect(page.locator('text=TechStart Tunisia')).toBeVisible();
      await expect(page.locator('text=Acme Corporation')).not.toBeVisible();
      
      // Clear search
      await searchInput.fill('');
      
      // Should show all clients again
      await expect(page.locator('text=Acme Corporation')).toBeVisible();
    }
  });

  test('should show client details', async ({ page }) => {
    // Click on a client name or view button
    await page.click('text=Acme Corporation, button:has-text("View"):first-of-type, a:has-text("View"):first-of-type');
    
    // Should show client details
    await expect(page.locator('text=contact@acme.com')).toBeVisible();
    await expect(page.locator('text=+1-555-0123')).toBeVisible();
    await expect(page.locator('text=123 Business St')).toBeVisible();
  });

  test('should handle custom fields for different countries', async ({ page }) => {
    await page.click('button:has-text("Add Client"), a:has-text("Add Client")');
    
    // Select Tunisia as country
    await page.selectOption('select[name="country"]', 'TN');
    
    // Should show Tunisian-specific custom fields
    await expect(page.locator('input[name*="tax_registration"], label:has-text("Tax Registration")')).toBeVisible();
    
    // Select US as country
    await page.selectOption('select[name="country"]', 'US');
    
    // Should show US-specific custom fields
    await expect(page.locator('input[name*="business_license"], label:has-text("Business License")')).toBeVisible();
  });

  test('should paginate clients list if there are many clients', async ({ page }) => {
    // Look for pagination controls
    const pagination = page.locator('.pagination, [aria-label="Pagination"], button:has-text("Next"), button:has-text("Previous")');
    
    if (await pagination.isVisible()) {
      // Test pagination functionality
      await page.click('button:has-text("Next"), button:has-text("2")');
      
      // Should load next page
      await expect(page).toHaveURL(/page=2|offset=/);
    }
  });
});
