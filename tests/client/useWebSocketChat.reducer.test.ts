import { test, expect } from 'bun:test';
import { __test__ } from '../../src/client/hooks/useWebSocketChat';
import type { ConversationState, Message } from '../../src/client/types';

function makeState(params: {
    conversationId: string;
    messages: Message[];
    conversationState: ConversationState;
}) {
    return {
        ...__test__.initialState,
        conversationId: params.conversationId,
        messages: params.messages,
        conversationStates: new Map([[params.conversationId, params.conversationState]]),
        pendingConfirmations: new Map(__test__.initialState.pendingConfirmations),
    };
}

test('RUN_COMPLETE preserves assistant stableId but updates persisted id', () => {
    const conversationId = 'c1';
    const runId = 'run-1';

    const assistant: Message = {
        id: runId,
        stableId: runId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        thoughts: [],
    };

    const state = makeState({
        conversationId,
        messages: [assistant],
        conversationState: {
            isProcessing: true,
            isStopped: false,
            isCompleted: false,
            messages: [assistant],
        },
    });

    const next = __test__.chatReducer(state, {
        type: 'RUN_COMPLETE',
        conversationId,
        runId,
        response: 'done',
        stepId: 42,
    });

    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.id).toBe('42');
    expect(next.messages[0]?.stableId).toBe(runId);
    expect(next.conversationStates.get(conversationId)?.messages[0]?.stableId).toBe(runId);
});

test('RUN_COMPLETE appends assistant with stepId stableId when missing', () => {
    const conversationId = 'c1';
    const runId = 'run-1';

    const state = makeState({
        conversationId,
        messages: [],
        conversationState: {
            isProcessing: true,
            isStopped: false,
            isCompleted: false,
            messages: [],
        },
    });

    const next = __test__.chatReducer(state, {
        type: 'RUN_COMPLETE',
        conversationId,
        runId,
        response: 'done',
        stepId: 7,
    });

    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.id).toBe('7');
    expect(next.messages[0]?.stableId).toBe('7');
});

test('SET_CONVERSATION_ID switches visible messages to target conversation', () => {
    const state = {
        ...__test__.initialState,
        conversationId: 'a',
        messages: [{ id: 'm1', stableId: 'm1', role: 'assistant', content: 'from a' }],
        conversationStates: new Map([
            ['a', { isProcessing: false, isStopped: false, isCompleted: false, messages: [{ id: 'm1', stableId: 'm1', role: 'assistant', content: 'from a' }] }],
            ['b', { isProcessing: false, isStopped: false, isCompleted: false, messages: [{ id: 'm2', stableId: 'm2', role: 'assistant', content: 'from b' }] }],
        ]),
        pendingConfirmations: new Map(__test__.initialState.pendingConfirmations),
    };

    const next = __test__.chatReducer(state, { type: 'SET_CONVERSATION_ID', id: 'b' });
    expect(next.conversationId).toBe('b');
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.content).toBe('from b');
});

test('SET_CONVERSATION_ID clears visible messages when target has no cached state', () => {
    const state = {
        ...__test__.initialState,
        conversationId: 'a',
        messages: [{ id: 'm1', stableId: 'm1', role: 'assistant', content: 'from a' }],
        conversationStates: new Map([
            ['a', { isProcessing: true, isStopped: false, isCompleted: false, messages: [{ id: 'm1', stableId: 'm1', role: 'assistant', content: 'from a' }] }],
        ]),
        pendingConfirmations: new Map(__test__.initialState.pendingConfirmations),
        runStatus: 'running' as const,
        currentRunId: 'run-a',
    };

    const next = __test__.chatReducer(state, { type: 'SET_CONVERSATION_ID', id: 'b' });
    expect(next.conversationId).toBe('b');
    expect(next.messages).toHaveLength(0);
    expect(next.runStatus).toBe('idle');
});
