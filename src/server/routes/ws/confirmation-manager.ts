/**
 * Confirmation Manager
 *
 * Manages the lifecycle of confirmation requests within a run.
 * Handles parallel confirmations, timeout, and cleanup.
 *
 * Works with ConversationEventBus + RunHandle (transport-agnostic).
 */

import type { ConversationEventBus } from '../../events/conversation-event-bus';
import type { RunHandle } from '../../events/conversation-event-bus';
import {
    type ConfirmationRequest,
    type ConfirmationResponse,
    type ConfirmationCallback,
    CONFIRMATION_OPTIONS,
} from '../../processor/confirmation';
import type { PendingConfirmation } from './message-types';
import { createChildLogger } from '../../logger';

const log = createChildLogger({ component: 'confirmation-manager' });

/**
 * Get the confirmation key for a request.
 * Format: "operation" or "operation:operationType"
 */
function getConfirmationKey(request: ConfirmationRequest): string {
    const operationType = request.context?.operationType;
    return operationType ? `${request.operation}:${operationType}` : request.operation;
}

/**
 * Create a confirmation callback that publishes requests to the bus.
 * All subscribers see the request; first response wins.
 */
export function createConfirmationCallback(
    bus: ConversationEventBus,
    conversationId: string,
    runHandle: RunHandle,
): ConfirmationCallback {
    return async (request: ConfirmationRequest): Promise<ConfirmationResponse> => {
        return new Promise((resolve, reject) => {
            runHandle.pendingConfirmations.set(request.requestId, {
                requestId: request.requestId,
                request,
                resolve,
                reject,
            });

            log.info({
                requestId: request.requestId,
                title: request.title,
                conversationId,
                runId: runHandle.runId,
                pendingCount: runHandle.pendingConfirmations.size,
            }, 'Requesting confirmation');

            bus.publish({
                type: 'confirmation_request',
                conversationId,
                runId: runHandle.runId,
                data: request,
            });
        });
    };
}

/**
 * Handle a confirmation response.
 * When "Yes, don't ask again" is selected, auto-approves matching pending confirmations.
 */
export function handleConfirmationResponse(
    runHandle: RunHandle,
    response: ConfirmationResponse,
): boolean {
    const pending = runHandle.pendingConfirmations.get(response.requestId);

    if (!pending) {
        log.warn({
            requestId: response.requestId,
            runId: runHandle.runId,
        }, 'Received response for unknown confirmation');
        return false;
    }

    log.info({
        requestId: response.requestId,
        selectedOptionId: response.selectedOptionId,
        runId: runHandle.runId,
        remainingCount: runHandle.pendingConfirmations.size - 1,
    }, 'Confirmation response received');

    runHandle.pendingConfirmations.delete(response.requestId);
    pending.resolve(response);

    if (response.selectedOptionId === CONFIRMATION_OPTIONS.YES_DONT_ASK) {
        const sourceKey = getConfirmationKey(pending.request);
        const toAutoApprove: PendingConfirmation[] = [];

        for (const [, otherPending] of runHandle.pendingConfirmations) {
            if (getConfirmationKey(otherPending.request) === sourceKey) {
                toAutoApprove.push(otherPending);
            }
        }

        if (toAutoApprove.length > 0) {
            log.info({
                runId: runHandle.runId,
                confirmationKey: sourceKey,
                autoApprovedCount: toAutoApprove.length,
            }, 'Auto-approving matching pending confirmations');

            for (const otherPending of toAutoApprove) {
                runHandle.pendingConfirmations.delete(otherPending.requestId);
                otherPending.resolve({
                    requestId: otherPending.requestId,
                    selectedOptionId: CONFIRMATION_OPTIONS.YES_DONT_ASK,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }

    return true;
}

/**
 * Reject all pending confirmations for a run
 */
export function rejectAllConfirmations(
    runHandle: RunHandle,
    reason: string,
): void {
    if (runHandle.pendingConfirmations.size === 0) {
        return;
    }

    log.info({
        runId: runHandle.runId,
        count: runHandle.pendingConfirmations.size,
        reason,
    }, 'Rejecting all pending confirmations');

    for (const [, pending] of runHandle.pendingConfirmations) {
        pending.reject(new Error(reason));
    }
    runHandle.pendingConfirmations.clear();
}

/**
 * Check if there are any blocking confirmations
 */
export function hasBlockingConfirmations(runHandle: RunHandle): boolean {
    return runHandle.pendingConfirmations.size > 0;
}
