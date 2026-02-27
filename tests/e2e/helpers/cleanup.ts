import type { Page } from '@playwright/test';
import { HomePage, ChatPage } from './page-objects';
import { Selectors } from './selectors';

/**
 * Stop all currently active runs visible on Home (running or needs_input).
 *
 * E2E tests share a single server process; runs continue even if the page that started them is closed.
 * This helper prevents state leakage (active tasks + confirmation toasts) into later tests.
 */
export async function stopAllActiveRunsFromHome(page: Page, opts?: { maxPasses?: number }): Promise<void> {
    const maxPasses = opts?.maxPasses ?? 10;
    const homePage = new HomePage(page);
    const chatPage = new ChatPage(page);

    // Always return to Home before cleanup, but preserve React state if we're already in-app.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await homePage.waitForConnection();

    for (let pass = 0; pass < maxPasses; pass++) {
        const activeCard = page.locator(`${Selectors.taskCard}.running, ${Selectors.taskCard}.needs-input`).first();
        const activeCount = await page.locator(`${Selectors.taskCard}.running, ${Selectors.taskCard}.needs-input`).count();
        if (activeCount === 0) return;

        const cardTitle = ((await activeCard.locator('.task-card-title').textContent()) || '').trim();

        // Toasts can overlap task cards; trigger click via DOM to avoid pointer interception flakes.
        await activeCard.evaluate((el: HTMLElement) => el.click());
        await chatPage.waitForConnection();

        // If a confirmation is pending, resolve it so it doesn't leak into later tests.
        try {
            if (await chatPage.confirmationDialog.isVisible()) {
                await chatPage.clickConfirmationButton('no');
                await chatPage.confirmationDialog.waitFor({ state: 'hidden', timeout: 15000 });
                await chatPage.waitForAssistantResponse();
                await chatPage.waitForIdle();
            } else if (cardTitle) {
                const toast = page.locator(Selectors.confirmationToast, { hasText: cardTitle }).first();
                if (await toast.isVisible()) {
                    const noBtn = toast.locator('.toast-actions .toast-btn.danger');
                    await noBtn.evaluate((el: HTMLElement) => el.click());
                    await toast.waitFor({ state: 'hidden', timeout: 15000 });
                    // Let the run proceed to completion if it was blocked.
                    await chatPage.waitForAssistantResponse();
                    await chatPage.waitForIdle();
                }
            }
        } catch {
            // ignore
        }

        // If still processing (non-confirmation long runs), stop to speed up cleanup.
        try {
            if (await chatPage.isProcessing()) {
                await chatPage.stopTask();
                await chatPage.waitForIdle();
            }
        } catch {
            // ignore
        }

        try {
            await chatPage.waitForIdle();
        } catch {
            // ignore
        }

        await chatPage.goHome();
        await homePage.waitForConnection();
    }
}
