/**
 * Stop Command Handler
 *
 * Handles hard stop requests from the client.
 * Routes through the ConversationEventBus.
 */

import type { Command, CommandContext } from './index';
import type { ClientMessage, StopCommand } from '../message-types';
import { getBus } from '../../../events/conversation-event-bus';
import { rejectAllConfirmations } from '../confirmation-manager';
import { setSessionInactive } from '../../../sessions/activeSessionsStore';
import { createChildLogger } from '../../../logger';

const log = createChildLogger({ component: 'stop-command' });

export const StopCommandHandler: Command<StopCommand> = {
    matches(message: ClientMessage): message is StopCommand {
        return message.type === 'stop';
    },

    async execute(ctx: CommandContext, message: StopCommand): Promise<void> {
        const { conversationId, runId } = message;

        const bus = getBus(conversationId);
        if (!bus?.activeRun) {
            log.warn({ conversationId }, 'Stop with no active run');
            return;
        }

        const runHandle = bus.activeRun;

        // Optional: verify runId matches
        if (runId && runHandle.runId !== runId) {
            log.warn({
                conversationId,
                expectedRunId: runId,
                actualRunId: runHandle.runId,
            }, 'Stop for wrong run');
            return;
        }

        log.info({
            conversationId,
            runId: runHandle.runId,
        }, 'Hard stop requested');

        runHandle.stopMode = 'hard';
        runHandle.stopReason = 'user_stop';
        runHandle.queuedMessages = [];
        runHandle.abortController.abort();
        rejectAllConfirmations(runHandle, 'Research stopped');

        // Immediately mark as inactive so refresh/observe sees no active run.
        // The run-executor will call these again when it catches the abort — both are idempotent.
        setSessionInactive(conversationId);
        bus.activeRun = null;
    },
};
