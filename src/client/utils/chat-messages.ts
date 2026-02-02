import type { Message } from '../types';

export function isNumericIdString(value: string): boolean {
    return /^\d+$/.test(value);
}

/**
 * When history is loaded mid-run, we can end up with a trailing, history-derived assistant message
 * that has only thoughts (tool calls) and no content. If we also render a live run placeholder,
 * that tail becomes a duplicate "steps taken" block.
 */
export function trimHistoryTailAfterUser(messages: Message[]): Message[] {
    const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return messages;

    let end = messages.length;
    for (let i = messages.length - 1; i > lastUserIdx; i--) {
        const msg = messages[i];
        if (!msg) continue;
        const hasThoughts = (msg.thoughts?.length ?? 0) > 0;
        const hasContent = (msg.content ?? '').trim().length > 0;
        const isHistoryDerived = isNumericIdString(msg.stableId);
        const isTrimCandidate =
            msg.role === 'assistant'
            && !msg.isStreaming
            && hasThoughts
            && !hasContent
            && isHistoryDerived;

        if (!isTrimCandidate) break;
        end = i;
    }

    return end === messages.length ? messages : messages.slice(0, end);
}

