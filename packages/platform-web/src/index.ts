export * from './db/webDb.js';
export * from './vault/webVault.js';
export * from './sync/syncClient.js';

// Re-export from Dexie core so apps don't need a direct dependency.
export { liveQuery } from 'dexie';
