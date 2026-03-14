/**
 * Re-export shared auth crypto from @kp/core.
 * Fastify routes import from here to keep import paths stable.
 */
export { normalizeEmail, hashPassword, verifyPassword, newId, changePassword } from '@kp/core';
