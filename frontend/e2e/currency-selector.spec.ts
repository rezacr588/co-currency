import { test, expect } from '@playwright/test';

test.describe('Currency Selector Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should open currency selector modal when clicking currency button', async ({ page }) => {
    // Click on the FROM currency selector button (look for the currency code and flag)
    const fromCurrencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await fromCurrencyButton.click();

    // Check if modal is visible
    const modal = page.locator('.currency-modal-backdrop');
    await expect(modal).toBeVisible();

    // Check if modal has the header
    const modalHeader = page.locator('h3:has-text("Select Currency")');
    await expect(modalHeader).toBeVisible();

    // Check if search input is visible and focused
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
  });

  test('should display as centered modal with backdrop', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await currencyButton.click();

    // Check modal backdrop styling
    const backdrop = page.locator('.currency-modal-backdrop');
    await expect(backdrop).toHaveClass(/fixed inset-0 z-\[9999\]/);
    await expect(backdrop).toHaveClass(/flex items-center justify-center/);

    // Check modal container
    const modalContainer = backdrop.locator('div').first();
    await expect(modalContainer).toHaveClass(/max-w-md/);
  });

  test('should close modal when clicking backdrop', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await currencyButton.click();

    // Verify modal is open
    const backdrop = page.locator('.currency-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Click on the backdrop (not the modal content)
    await backdrop.click({ position: { x: 10, y: 10 } });

    // Verify modal is closed
    await expect(backdrop).not.toBeVisible();
  });

  test('should close modal when clicking close button', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await currencyButton.click();

    // Verify modal is open
    const backdrop = page.locator('.currency-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Click the close button
    const closeButton = page.locator('button[aria-label="Close"]');
    await closeButton.click();

    // Verify modal is closed
    await expect(backdrop).not.toBeVisible();
  });

  test('should close modal when pressing Escape key', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await currencyButton.click();

    // Verify modal is open
    const backdrop = page.locator('.currency-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await expect(backdrop).not.toBeVisible();
  });

  test('should search and filter currencies', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await currencyButton.click();

    // Get the search input
    const searchInput = page.locator('input[placeholder*="Search"]');

    // Type "USD" in search
    await searchInput.fill('USD');

    // Check that USD is visible in the list
    const usdOption = page.locator('li[role="option"]:has-text("USD")');
    await expect(usdOption).toBeVisible();

    // Check that the list is filtered (should have fewer items)
    const allOptions = page.locator('li[role="option"]');
    const count = await allOptions.count();
    expect(count).toBeLessThan(10); // Should be filtered down
  });

  test('should select a currency and close modal', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();

    // Get the current currency code
    const originalCurrency = await currencyButton.textContent();

    await currencyButton.click();

    // Wait for modal
    const backdrop = page.locator('.currency-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Search for EUR
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('EUR');

    // Click on EUR option
    const eurOption = page.locator('li[role="option"]:has-text("EUR")');
    await eurOption.click();

    // Verify modal is closed
    await expect(backdrop).not.toBeVisible();

    // Verify currency was changed (if it wasn't EUR already)
    if (!originalCurrency?.includes('EUR')) {
      const newCurrency = await currencyButton.textContent();
      expect(newCurrency).toContain('EUR');
    }
  });

  test('should show selected currency with checkmark', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    const currentCurrency = await currencyButton.textContent();
    const currencyCode = currentCurrency?.match(/[A-Z]{3}/)?.[0];

    await currencyButton.click();

    // Find the selected currency in the list
    if (currencyCode) {
      const selectedOption = page.locator(`li[role="option"][data-selected="true"]`);
      await expect(selectedOption).toBeVisible();

      // Check for the checkmark icon
      const checkmark = selectedOption.locator('svg').last();
      await expect(checkmark).toBeVisible();
    }
  });

  test('should show "No currency found" when search has no results', async ({ page }) => {
    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await currencyButton.click();

    // Search for something that doesn't exist
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('ZZZZZZZ');

    // Check for "No currency found" message
    const noResultsMessage = page.locator('text=/No currency found/i');
    await expect(noResultsMessage).toBeVisible();
  });

  test('should work on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Open the modal
    const currencyButton = page.locator('button[aria-haspopup="listbox"]').first();
    await currencyButton.click();

    // Verify modal is responsive
    const backdrop = page.locator('.currency-modal-backdrop');
    await expect(backdrop).toBeVisible();

    const modalContainer = backdrop.locator('div').first();
    await expect(modalContainer).toBeVisible();

    // Modal should be centered and responsive
    await expect(modalContainer).toHaveClass(/mx-4/);
  });
});
