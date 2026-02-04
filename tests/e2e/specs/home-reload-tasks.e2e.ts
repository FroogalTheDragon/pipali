/**
 * Home reload regression tests
 *
 * Ensures task cards persist across a page reload (localStorage hydration).
 */

import { test, expect } from '@playwright/test';
import { HomePage, ChatPage } from '../helpers/page-objects';

const PAUSABLE_QUERY = 'run a pausable analysis';

test.describe('Home Reload Task Cards', () => {
    test('running task card persists on home reload', async ({ page }) => {
        const homePage = new HomePage(page);
        await homePage.goto();

        await homePage.sendBackgroundMessage(PAUSABLE_QUERY);
        await homePage.waitForTaskCount(1);

        await page.waitForTimeout(500);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await homePage.waitForConnection();

        await homePage.waitForTaskCount(1);
        expect(await homePage.getTaskCardCount()).toBeGreaterThanOrEqual(1);
        expect(await homePage.getTaskStatus(0)).toBe('running');
    });

    test('completed task card persists on home reload', async ({ page }) => {
        const chatPage = new ChatPage(page);
        await chatPage.goto();

        await chatPage.sendMessage('list all files');
        await chatPage.waitForAssistantResponse();

        await chatPage.goHome();

        const homePage = new HomePage(page);
        await homePage.waitForConnection();
        await homePage.waitForTaskCount(1);
        expect(await homePage.getTaskStatus(0)).toBe('completed');

        await page.waitForTimeout(500);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await homePage.waitForConnection();

        await homePage.waitForTaskCount(1);
        expect(await homePage.getTaskCardCount()).toBeGreaterThanOrEqual(1);
        expect(await homePage.getTaskStatus(0)).toBe('completed');
    });
});

