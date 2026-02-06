/**
 * Pub-sub Reload Dedupe Regression Tests
 *
 * Repro:
 * - While a run is active, reloading the chat or home page can:
 *   1) Duplicate steps (history + replay events appended again)
 *   2) Re-show confirmations that were already acknowledged
 *
 * These tests lock in the expected behavior: reloads must not duplicate tool steps
 * or replay already-handled confirmations.
 */

import { test, expect, type Page } from '@playwright/test';
import { ChatPage, HomePage } from '../helpers/page-objects';
import { Selectors } from '../helpers/selectors';

function makeReproQuery(): string {
    return `repro pubsub reload ${Date.now()}`;
}

async function assertNoDuplicateThoughtMarkers(page: Page) {
    const markers = [
        'repro-shell-1',
        'repro-pattern-2',
        'repro-pattern-3',
        'repro-list-4',
        'repro-pattern-5',
    ];

    for (const marker of markers) {
        await expect(page.locator(Selectors.thoughtItem, { hasText: marker })).toHaveCount(1);
    }

    // Each iteration produces one rendered tool entry in the thoughts list.
    await expect(page.locator(Selectors.thoughtTool)).toHaveCount(markers.length);
}

test.describe('Pub-sub Reload Dedupe', () => {
    test('chat reload mid-run does not duplicate steps or re-show acknowledged confirmation', async ({ page }) => {
        const reproQuery = makeReproQuery();
        const chatPage = new ChatPage(page);
        await chatPage.goto();
        await chatPage.startNewChat();
        await chatPage.waitForConnection();

        await chatPage.sendMessage(reproQuery);
        await chatPage.waitForProcessing();

        // Step 1 is confirmation-gated (shell_command)
        await chatPage.waitForConfirmationDialog();
        await chatPage.clickConfirmationButton('yes');
        await expect(chatPage.confirmationDialog).toHaveCount(0);

        // Ensure multiple steps have arrived and the run is still active before reload
        await chatPage.waitForThoughts();
        await chatPage.waitForThoughtCount(2);
        await expect(chatPage.stopButton).toBeVisible();

        // Reload during an active run
        await page.reload();
        await chatPage.waitForConnection();

        // Previously acknowledged confirmation must not re-appear after reload/replay
        await expect(chatPage.confirmationDialog).toHaveCount(0, { timeout: 5000 });

        // Run completes normally
        await chatPage.waitForAssistantResponse();
        await chatPage.waitForIdle();

        await chatPage.expandThoughts();
        await assertNoDuplicateThoughtMarkers(page);
    });

    test('home reload mid-run does not duplicate steps or re-show acknowledged confirmation toast', async ({ page }) => {
        const reproQuery = makeReproQuery();
        const homePage = new HomePage(page);
        await homePage.goto();

        // Start as a background task so confirmations show as toasts on home.
        await homePage.sendBackgroundMessage(reproQuery);
        await homePage.waitForTaskWithTitle(reproQuery);

        const toast = page.locator(Selectors.confirmationToast, { hasText: reproQuery }).first();
        await toast.waitFor({ state: 'visible', timeout: 15000 });

        // Click "Yes" on the toast confirmation
        await toast.locator('.toast-actions .toast-btn.primary').click();
        await expect(page.locator(Selectors.confirmationToast, { hasText: reproQuery })).toHaveCount(0, { timeout: 15000 });

        // Ensure the confirmation was actually acknowledged by the server
        // (the task should move past "Needs Input" and progress beyond step 1).
        const firstCard = page.locator(Selectors.taskCard, { hasText: reproQuery }).first();
        await expect(firstCard).toBeVisible();
        await expect(firstCard.locator('.task-status-text.needs-input')).toHaveCount(0, { timeout: 15000 });
        // Ensure it's still active (not completed immediately) so reload happens mid-run.
        await expect(firstCard.locator('.task-status-text.running')).toBeVisible({ timeout: 15000 });

        // Open the conversation (to capture the conversationId reliably)
        await firstCard.click();
        const chatPage = new ChatPage(page);
        await chatPage.waitForConnection();
        const conversationId = await chatPage.getConversationId();
        expect(conversationId).toBeTruthy();

        // The previously acknowledged confirmation must not show up again in the conversation view
        await expect(chatPage.confirmationDialog).toHaveCount(0, { timeout: 5000 });

        // Navigate back to home, then reload the home page mid-run
        await chatPage.goHome();
        await homePage.waitForConnection();
        await expect(page.locator(Selectors.taskCard, { hasText: reproQuery })).toBeVisible();

        await page.reload();
        await homePage.waitForConnection();

        // The acknowledged confirmation toast must not re-appear after reload
        await expect(page.locator(Selectors.confirmationToast)).toHaveCount(0, { timeout: 5000 });

        // Go back to the conversation and verify steps weren't duplicated on reload/replay
        await chatPage.gotoConversation(conversationId!);
        await chatPage.waitForAssistantResponse();
        await chatPage.waitForIdle();

        await chatPage.expandThoughts();
        await assertNoDuplicateThoughtMarkers(page);
    });
});
