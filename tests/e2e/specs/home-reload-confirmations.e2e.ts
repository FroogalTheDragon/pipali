/**
 * Home reload confirmation regression tests
 *
 * Ensures pending confirmation requests (needs_input) are visible on Home
 * after a page reload (via observe + replay).
 */

import { test, expect } from '@playwright/test';
import { HomePage } from '../helpers/page-objects';
import { Selectors } from '../helpers/selectors';
import { stopAllActiveRunsFromHome } from '../helpers/cleanup';

function makeReproQuery(): string {
    // Include a unique marker so we can target the specific toast/card in noisy suites.
    return `repro pubsub reload [e2e-${Date.now()}]`;
}

test.describe('Home Reload Confirmations', () => {
    test('pending confirmation toast persists on home reload', async ({ page }) => {
        await page.addInitScript(() => {
            try {
                if (!window.sessionStorage.getItem('__e2e_storage_cleared__')) {
                    window.localStorage.clear();
                    window.sessionStorage.clear();
                    window.sessionStorage.setItem('__e2e_storage_cleared__', '1');
                }
            } catch {
                // ignore
            }
        });

        const reproQuery = makeReproQuery();
        const homePage = new HomePage(page);
        await homePage.goto();

        // Start a background run that triggers a confirmation request immediately.
        await homePage.sendBackgroundMessage(reproQuery);
        const taskCard = page.locator(Selectors.taskCard, { hasText: reproQuery });
        await expect(taskCard).toBeVisible({ timeout: 15000 });

        const toast = page.locator(Selectors.confirmationToast, { hasText: reproQuery });
        await expect(toast.first()).toBeVisible({ timeout: 15000 });

        // Reload while the run is blocked on confirmation.
        await page.waitForTimeout(250);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await homePage.waitForConnection();

        // The pending confirmation should be visible again on Home after reload.
        await expect(page.locator(Selectors.confirmationToast, { hasText: reproQuery }).first()).toBeVisible({ timeout: 15000 });

        // Cleanup: decline so the run can continue/finish and doesn't block later tests.
        const noBtn = page
            .locator(Selectors.confirmationToast, { hasText: reproQuery })
            .first()
            .locator('.toast-actions .toast-btn.danger');
        await expect(noBtn).toBeVisible({ timeout: 15000 });
        // Toast can be positioned near the viewport edge; trigger the click via DOM to avoid viewport flake.
        await noBtn.evaluate((el: HTMLElement) => el.click());
        await expect(page.locator(Selectors.confirmationToast, { hasText: reproQuery })).toHaveCount(0, { timeout: 15000 });

        // Ensure the background run is not left active across tests.
        await stopAllActiveRunsFromHome(page);
    });
});
