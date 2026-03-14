/**
 * @kp/core/api — Shared API business logic.
 * Used by both Fastify (local dev) and Hono (hosted) routes.
 */
export {
  normalizeEmail,
  newId,
  hashPassword,
  verifyPassword,
  changePassword,
} from './authCrypto.js';

export { signToken, verifyToken, requireAuth, type AuthPayload } from './authJwt.js';

export { classifyCoinbaseError, type ApiErrorResponse } from './apiErrors.js';

export {
  DeviceSchema,
  EnvelopeSchema,
  EnvelopeQuerySchema,
  mapEnvelopeRow,
  type DeviceInput,
  type EnvelopeInput,
  type EnvelopeQuery,
} from './syncSchemas.js';

export {
  EnableModeSchema,
  EnableServerAlertsSchema,
  MirrorStateBodySchema,
  TriggerLogQuerySchema,
  isAlertInCooldown,
  mapTriggerLogRow,
  type EnableServerAlertsInput,
  type EnableMode,
} from './alertSchemas.js';

export {
  getCached,
  setCached,
  coingeckoBase,
  coingeckoHeaders,
  normalizeSearchResponse,
  normalizeSimplePricesResponse,
  testSearchCoins,
  testSimplePrices,
  type CoingeckoConfig,
  type CoinSearchResult,
  type SimplePricesResult,
} from './coingeckoProxy.js';

export {
  WebPushSubscribeSchema,
  WebPushUnsubscribeSchema,
  ExpoPushTokenSchema,
  type WebPushSubscribeInput,
  type WebPushUnsubscribeInput,
} from './pushSchemas.js';
