/**
 * Shared Zod schemas for push notification endpoints.
 */
import { z } from 'zod';

export const WebPushSubscribeSchema = z.object({
  subscription: z.record(z.any()),
});

export const WebPushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const ExpoPushTokenSchema = z.object({
  token: z.string().min(10),
});

export type WebPushSubscribeInput = z.infer<typeof WebPushSubscribeSchema>;
export type WebPushUnsubscribeInput = z.infer<typeof WebPushUnsubscribeSchema>;
