/**
 * Shared Zod schemas for alert endpoints.
 */
import { z } from 'zod';
import { AlertSchema, MirrorStateSchema } from '../domain/alert.js';

export const EnableModeSchema = z.enum(['enable_only', 'merge', 'replace']);

export const EnableServerAlertsSchema = z.object({
  mode: EnableModeSchema.optional(),
  alerts: z.array(AlertSchema).default([]),
  state: MirrorStateSchema,
});

export const MirrorStateBodySchema = z.object({
  state: MirrorStateSchema,
});

export const TriggerLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type EnableServerAlertsInput = z.infer<typeof EnableServerAlertsSchema>;
export type EnableMode = z.infer<typeof EnableModeSchema>;

/**
 * Check if an alert is within its cooldown period.
 */
export function isAlertInCooldown(
  lastTriggeredAtISO: string | null | undefined,
  cooldownMin: number,
  nowISO: string,
): boolean {
  if (!lastTriggeredAtISO || cooldownMin <= 0) return false;
  const last = Date.parse(lastTriggeredAtISO);
  const now = Date.parse(nowISO);
  if (Number.isNaN(last)) return false;
  return now - last < cooldownMin * 60_000;
}

/**
 * Map a raw trigger log DB row to the canonical response shape.
 */
export function mapTriggerLogRow(r: Record<string, unknown>) {
  const contextJson = String(r.contextJson ?? r.context_json ?? '{}');
  let context: unknown;
  try {
    context = JSON.parse(contextJson);
  } catch {
    context = {};
  }
  return {
    id: r.id as string,
    alertId: (r.alertId ?? r.alert_id) as string,
    triggeredAtISO: (r.triggeredAtISO ?? r.triggered_at_iso) as string,
    source: r.source as string,
    context,
  };
}
