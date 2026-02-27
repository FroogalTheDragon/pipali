// Singleton reference to the Bun server instance.
// Used for global WebSocket topic broadcasts (e.g. run_started to all clients).

import type { Server } from 'bun';

let serverInstance: Server<any> | null = null;

export function setServer(server: Server<any>): void {
    serverInstance = server;
}

export function getServer(): Server<any> | null {
    return serverInstance;
}
