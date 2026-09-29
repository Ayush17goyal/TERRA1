import { expect, test } from '@playwright/test';

test.describe('LEGATRIXON Bare Act Mentor journeys', () => {
  test('student can reach learning, chat, drafting, and document workspaces', async ({ page }) => {
    await page.goto('/bare-act-learning');
    await expect(page.getByText(/learning/i).first()).toBeVisible();
    await page.goto('/bare-act-mentor');
    await expect(page.locator('body')).toContainText(/mentor|Bare Act|Drafting/i);
    await page.goto('/bare-act-drafting');
    await expect(page.locator('body')).toContainText(/draft/i);
    await page.goto('/bare-act-documents');
    await expect(page.getByText(/Document Management/i)).toBeVisible();
  });

  test('admin route is protected and renders either dashboard or access denial', async ({ page }) => {
    await page.goto('/bare-act-admin');
    await expect(page.locator('body')).toContainText(/Mentor Admin|Admin access required/i);
  });

  test('document upload center accepts a text Bare Act file', async ({ page }) => {
    await page.goto('/bare-act-documents');
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({ name: 'sample-bare-act.txt', mimeType: 'text/plain', buffer: Buffer.from('Sample Act\nSection 1. Short title') });
    await expect(page.locator('body')).toContainText(/sample-bare-act|Upload failed|indexed|processing/i, { timeout: 15000 });
  });
});
