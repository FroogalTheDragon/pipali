/**
 * Integration test for the shell-quote \! escaping fix in wrapCommandWithSandbox.
 *
 * shell-quote escapes ! to \! when falling back to double-quote wrapping (triggered
 * by single quotes in heredocs). Non-interactive bash doesn't consume \!, so the
 * backslash leaks into scripts causing SyntaxErrors (e.g. Python's != becomes \!=).
 *
 * Requires: SANDBOX_INTEGRATION_TESTS=true, run outside any existing sandbox.
 */

import { test, expect, describe, afterEach } from 'bun:test';
import os from 'os';
import {
    wrapCommandWithSandbox,
    initializeSandboxWithConfig,
    shutdownSandbox,
} from '../../../src/server/sandbox';
import { getDefaultConfig } from '../../../src/server/sandbox/config';

describe('Sandbox command quoting', () => {
    const isSupported = process.platform === 'darwin' || process.platform === 'linux';
    const runIntegrationTests = process.env.SANDBOX_INTEGRATION_TESTS === 'true';
    const testFn = isSupported && runIntegrationTests ? test : test.skip;

    const config = {
        ...getDefaultConfig(),
        allowedWritePaths: ['/tmp', '/private/tmp', `${os.homedir()}/.pipali`],
    };

    afterEach(async () => {
        await shutdownSandbox();
    });

    testFn('Python heredoc with != runs correctly through wrapCommandWithSandbox', async () => {
        await initializeSandboxWithConfig(config);

        // This command triggers shell-quote's double-quote fallback (due to <<'PY')
        // which would escape ! to \!, breaking Python's != without proper escaping
        const cmd = `python3 - <<'PY'
data = {'key': 'value'}
for k, v in data.items():
    if k != 'missing':
        print(f'{k}={v}')
PY`;
        const wrappedCmd = await wrapCommandWithSandbox(cmd);

        const proc = Bun.spawn(['bash', '-c', wrappedCmd], {
            stdout: 'pipe',
            stderr: 'pipe',
        });

        const exitCode = await proc.exited;
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();

        expect(stderr).not.toContain('SyntaxError');
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe('key=value');
    });
});
