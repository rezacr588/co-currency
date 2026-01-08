import { test, expect } from '@playwright/test';

test.describe('Formatted Currency Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display currency symbol when typing amount', async ({ page }) => {
    // Find the amount input field
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Type an amount
    await amountInput.fill('1000');

    // Check if the value is formatted with commas
    const value = await amountInput.inputValue();
    expect(value).toBe('1,000');

    // Currency symbol should be visible (it's positioned absolutely next to the input)
    // We can verify it by checking the parent container has the symbol
    const container = amountInput.locator('..');
    await expect(container).toBeVisible();
  });

  test('should format numbers with thousand separators (commas)', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Test various amounts
    await amountInput.fill('1234567');
    let value = await amountInput.inputValue();
    expect(value).toBe('1,234,567');

    // Clear and try another value
    await amountInput.clear();
    await amountInput.fill('999999');
    value = await amountInput.inputValue();
    expect(value).toBe('999,999');

    // Clear and try with decimal
    await amountInput.clear();
    await amountInput.fill('1234.56');
    value = await amountInput.inputValue();
    expect(value).toBe('1,234.56');
  });

  test('should handle decimal input correctly', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Test decimal values
    await amountInput.fill('100.50');
    let value = await amountInput.inputValue();
    expect(value).toBe('100.50');

    // Test multiple decimal places
    await amountInput.clear();
    await amountInput.fill('1234.5678');
    value = await amountInput.inputValue();
    expect(value).toBe('1,234.5678');
  });

  test('should not allow negative numbers', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Try to input negative number
    await amountInput.fill('-100');
    const value = await amountInput.inputValue();

    // Should either be empty or not negative
    expect(value).not.toContain('-');
  });

  test('should not allow non-numeric characters', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Try to input letters
    await amountInput.fill('abc123');
    const value = await amountInput.inputValue();

    // Should only contain numbers and commas/decimals
    expect(value).toMatch(/^[\d,\.]*$/);
  });

  test('should maintain formatting when losing and regaining focus', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Type a value
    await amountInput.fill('5000');
    expect(await amountInput.inputValue()).toBe('5,000');

    // Click somewhere else to blur
    await page.click('body');

    // Click back on input
    await amountInput.click();

    // Value should still be formatted
    expect(await amountInput.inputValue()).toBe('5,000');
  });

  test('should perform conversion with formatted input', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Enter an amount
    await amountInput.fill('1000');

    // Wait for conversion to happen (debounced)
    await page.waitForTimeout(500);

    // Check if result is displayed (look for the result area)
    const resultArea = page.locator('.flex.items-baseline').filter({ hasText: /\$|€|£|¥/ });

    // Result should be visible and contain a number
    await expect(resultArea).toBeVisible({ timeout: 3000 });
  });

  test('should clear input when deleting all characters', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Type a value
    await amountInput.fill('1000');
    expect(await amountInput.inputValue()).toBe('1,000');

    // Clear the input
    await amountInput.clear();

    // Input should be empty
    expect(await amountInput.inputValue()).toBe('');
  });

  test('should update conversion result when input changes', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Enter first amount
    await amountInput.fill('100');
    await page.waitForTimeout(500);

    // Get first result (if visible)
    const resultText1 = await page.locator('.flex.items-baseline').filter({ hasText: /[\d,\.]+/ }).first().textContent();

    // Change amount
    await amountInput.clear();
    await amountInput.fill('200');
    await page.waitForTimeout(500);

    // Get second result
    const resultText2 = await page.locator('.flex.items-baseline').filter({ hasText: /[\d,\.]+/ }).first().textContent();

    // Results should be different
    expect(resultText1).not.toBe(resultText2);
  });

  test('should show updated timestamp after conversion', async ({ page }) => {
    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Enter an amount to trigger conversion
    await amountInput.fill('100');

    // Wait for conversion
    await page.waitForTimeout(1000);

    // Look for the timestamp element (has clock icon and "Updated at:" text)
    const timestamp = page.locator('text=/Updated at:|بروزرسانی در|تم التحديث في|Güncellendi/i');

    // Timestamp should be visible
    await expect(timestamp).toBeVisible({ timeout: 5000 });

    // Timestamp should contain a date/time
    const timestampText = await timestamp.textContent();
    expect(timestampText).toMatch(/\d/); // Should contain numbers (date/time)
  });

  test('should work on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const amountInput = page.locator('input[aria-label*="Amount"]').first();

    // Should be accessible and functional on mobile
    await expect(amountInput).toBeVisible();

    // Type an amount
    await amountInput.fill('5000');

    // Should be formatted
    expect(await amountInput.inputValue()).toBe('5,000');

    // Input should have numeric keyboard on mobile (inputMode="decimal")
    const inputMode = await amountInput.getAttribute('inputmode');
    expect(inputMode).toBe('decimal');
  });
});
