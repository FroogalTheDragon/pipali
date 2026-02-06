/**
 * Home reload regression tests
 *
 * Ensures task cards persist across a page reload (localStorage hydration).
 */

import { test, expect } from '@playwright/test';
import { HomePage, ChatPage } from '../helpers/page-objects';
import { stopAllActiveRunsFromHome } from '../helpers/cleanup';

const PAUSABLE_QUERY = 'run a pausable analysis';

function uniqueQuery(base: string): string {
    return `${base} [e2e-${Date.now()}-${Math.random().toString(16).slice(2, 8)}]`;
}

test.describe('Home Reload Task Cards', () => {
    test.afterEach(async ({ page }) => {
        await stopAllActiveRunsFromHome(page);
    });

    test('running task card persists on home reload', async ({ page }) => {
        const homePage = new HomePage(page);
        await homePage.goto();

        const query = uniqueQuery(PAUSABLE_QUERY);
        await homePage.sendBackgroundMessage(query);
        await homePage.waitForTaskWithTitle(query);

        await page.waitForTimeout(500);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await homePage.waitForConnection();

        await homePage.waitForTaskWithTitle(query);
        const card = homePage.getTaskCardByTitle(query);
        await expect(card).toBeVisible();
        await expect(card.locator('.task-status-text.running')).toBeVisible();
    });

    test('completed task card persists on home reload', async ({ page }) => {
        const chatPage = new ChatPage(page);
        await chatPage.goto();

        const query = uniqueQuery('list all files');
        await chatPage.sendMessage(query);
        await chatPage.waitForAssistantResponse();

        await chatPage.goHome();

        const homePage = new HomePage(page);
        await homePage.waitForConnection();
        await homePage.waitForTaskWithTitle(query);
        await expect(homePage.getTaskCardByTitle(query).locator('.task-status-text.completed')).toBeVisible();

        await page.waitForTimeout(500);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await homePage.waitForConnection();

        await homePage.waitForTaskWithTitle(query);
        await expect(homePage.getTaskCardByTitle(query).locator('.task-status-text.completed')).toBeVisible();
    });
});
