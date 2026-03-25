/**
 * Notification utilities for Pipali.
 * In Tauri desktop app, sends native macOS notifications via Rust command with click handling.
 * In browser, uses Web Notification API.
 */

import { isTauri } from './tauri';
import type { ConfirmationRequest } from '../../server/processor/confirmation/confirmation.types';

let notificationPermissionGranted: boolean | null = null;

// Shared AudioContext for notification sounds (created lazily)
let audioCtx: AudioContext | null = null;

/**
 * Play a short two-tone chime for notifications using the Web Audio API.
 * No audio file required — synthesizes a brief ping sound.
 */
function playNotificationSound(): void {
    try {
        if (!audioCtx) {
            audioCtx = new AudioContext();
        }
        // Resume context if suspended (browsers require user gesture)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;

        // First tone — higher pitch
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 830;
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1).connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Second tone — slightly higher, delayed
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1050;
        gain2.gain.setValueAtTime(0.3, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(gain2).connect(audioCtx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.3);
    } catch {
        // Audio not available — silently ignore
    }
}

// Track active web notifications for cleanup
const activeWebNotifications: Map<string, Notification> = new Map();

// Callback for when a notification is clicked (used for navigation)
type NotificationClickHandler = (conversationId: string) => void;
let notificationClickHandler: NotificationClickHandler | null = null;

/**
 * Register a handler for notification clicks.
 * The handler receives the conversation ID associated with the notification.
 */
export function setNotificationClickHandler(handler: NotificationClickHandler | null): void {
    notificationClickHandler = handler;
}

/**
 * Send a web notification using the Web Notification API.
 * @param tag - Unique identifier for the notification (prevents duplicates with same tag)
 * @param title - Notification title
 * @param body - Notification body text
 * @param conversationId - Optional conversation ID for navigation on click
 * @returns The created Notification or null if failed
 */
function sendWebNotification(tag: string, title: string, body: string, conversationId?: string): Notification | null {
    if (!('Notification' in window) || !notificationPermissionGranted) {
        return null;
    }

    try {
        const notification = new Notification(title, {
            body,
            icon: '/icons/pipali_128.png',
            tag,
            requireInteraction: true,
        });

        notification.onclick = async () => {
            await focusAppWindow();
            notification.close();
            activeWebNotifications.delete(tag);
            // Navigate to the conversation if handler is registered
            if (conversationId && notificationClickHandler) {
                notificationClickHandler(conversationId);
            }
        };

        notification.onclose = () => {
            activeWebNotifications.delete(tag);
        };

        activeWebNotifications.set(tag, notification);
        return notification;
    } catch (err) {
        console.warn('[notifications] Failed to create web notification:', err);
        return null;
    }
}

/**
 * Check if the app tab/window is currently visible to the user.
 */
export function isWindowFocused(): boolean {
    // Check both visibility state and focus
    // When window is hidden to tray, visibilityState should be 'hidden'
    const isVisible = document.visibilityState === 'visible';
    const hasFocus = document.hasFocus();
    return isVisible && hasFocus;
}

/**
 * Send a native notification via the Rust backend.
 * Click handling is done via the `notification-clicked` Tauri event.
 */
async function sendTauriNotification(title: string, body: string, conversationId?: string): Promise<void> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('send_notification', {
            options: { title, body, conversationId: conversationId ?? null },
        });
    } catch (err) {
        console.warn('[notifications] Failed to send native notification:', err);
    }
}

/**
 * Initialize notification permissions.
 * Call this once when the app starts.
 */
export async function initNotifications(): Promise<boolean> {
    // Tauri desktop app — Rust handles native notifications via UNUserNotificationCenter.
    // Permission is requested on the Rust side during app init.
    if (isTauri()) {
        notificationPermissionGranted = true;
        return true;
    }

    // Web path - use Web Notification API
    if (!('Notification' in window)) {
        console.warn('[notifications] Web Notification API not supported');
        notificationPermissionGranted = false;
        return false;
    }

    if (Notification.permission === 'granted') {
        notificationPermissionGranted = true;
        return true;
    }

    if (Notification.permission === 'denied') {
        notificationPermissionGranted = false;
        return false;
    }

    try {
        const result = await Notification.requestPermission();
        notificationPermissionGranted = result === 'granted';
        return notificationPermissionGranted;
    } catch (err) {
        console.warn('[notifications] Failed to request web notification permission:', err);
        notificationPermissionGranted = false;
        return false;
    }
}

/**
 * Send a notification for a confirmation request.
 * Only sends if window is not focused.
 *
 * @param request - The confirmation request
 * @param conversationTitle - Optional title for context in the notification
 * @param conversationId - The conversation ID to navigate to when notification is clicked
 */
export async function notifyConfirmationRequest(
    request: ConfirmationRequest,
    conversationTitle?: string,
    conversationId?: string
): Promise<void> {
    // Always play sound for confirmation requests — user may not be looking at screen
    playNotificationSound();

    // Don't send visual notification if window is focused - user can see the toast
    if (isWindowFocused()) {
        return;
    }

    // Check permissions (lazy init)
    if (notificationPermissionGranted === null) {
        await initNotifications();
    }
    if (!notificationPermissionGranted) return;

    // Build notification content
    const title = request.operation === 'ask_user'
        ? 'Question from Pipali'
        : 'Action Required';

    const body = conversationTitle
        ? `${conversationTitle}: ${request.title}`
        : request.title;

    if (isTauri()) {
        await sendTauriNotification(title, body, conversationId);
        return;
    }

    const tag = `confirmation-${request.requestId}`;
    sendWebNotification(tag, title, body, conversationId);
}

/**
 * Send a notification when a task completes.
 * Uses native OS notifications in Tauri, or Web Notification API in browser.
 * Only sends if window is not focused.
 *
 * @param userRequest - The original user request/query
 * @param responseSnippet - A snippet of the agent's response
 * @param conversationId - The conversation ID to navigate to when notification is clicked
 */
export async function notifyTaskComplete(
    userRequest?: string,
    responseSnippet?: string,
    conversationId?: string
): Promise<void> {
    if (isWindowFocused()) return;

    playNotificationSound();

    // Check permissions (lazy init)
    if (notificationPermissionGranted === null) {
        await initNotifications();
    }
    if (!notificationPermissionGranted) return;

    // Build notification content
    const title = userRequest
        ? truncate(userRequest, 50)
        : 'Task Complete';

    const body = responseSnippet
        ? truncate(responseSnippet, 100)
        : 'Your task has finished';

    if (isTauri()) {
        await sendTauriNotification(title, body, conversationId);
        return;
    }

    const tag = `task-complete-${Date.now()}`;
    sendWebNotification(tag, title, body, conversationId);
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed.
 */
function truncate(text: string, maxLength: number): string {
    // Normalize whitespace (collapse newlines and multiple spaces)
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return normalized.slice(0, maxLength - 1) + '…';
}

/**
 * Focus the app window.
 * In Tauri, uses the focus_window command to properly show window and add to dock.
 * In browser, uses window.focus().
 */
export async function focusAppWindow(): Promise<void> {
    if (isTauri()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('focus_window');
        } catch (err) {
            console.warn('[notifications] Failed to focus Tauri window:', err);
        }
        return;
    }

    window.focus();
}

/**
 * Setup listener for the `notification-clicked` Tauri event.
 * When the Rust backend detects a notification click, it emits this event
 * with the conversation ID, and we navigate to that conversation.
 */
export function setupNotificationClickListener(): void {
    if (!isTauri()) return;

    import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('notification-clicked', (event) => {
            const convId = event.payload;
            if (convId && notificationClickHandler) {
                notificationClickHandler(convId);
            }
        });
    });
}
