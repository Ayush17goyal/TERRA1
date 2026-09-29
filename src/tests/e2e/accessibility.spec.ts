import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility journeys', () => {
  test('document management has no critical accessibility violations', async ({ page }) => {
    await page.goto('/bare-act-documents');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);
  });
});
