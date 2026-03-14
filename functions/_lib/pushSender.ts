import { buildWebPushRequest, type VapidKeys, type WebPushSubscription } from './webPush';
import type { Env } from './db';

export type PushMessage = {
  data: string;
  options?: { ttl?: number };
};

export function isWebPushConfigured(env: Env): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function getVapid(env: Env): VapidKeys {
  return {
    subject: String(env.VAPID_SUBJECT ?? 'mailto:admin@example.com'),
    publicKey: String(env.VAPID_PUBLIC_KEY ?? ''),
    privateKey: String(env.VAPID_PRIVATE_KEY ?? ''),
  };
}

function backoffNextAttemptISO(nowISO: string, failureCount: number): string {
  const baseMs = 60_000;
  const ms = Math.min(baseMs * Math.pow(2, Math.max(0, failureCount)), 24 * 60 * 60_000);
  return new Date(new Date(nowISO).getTime() + ms).toISOString();
}

export async function sendWebPushToUser(
  sql: any,
  env: Env,
  userId: string,
  message: PushMessage
): Promise<{ ok: boolean; attempted: number; delivered: number; deactivated: number; failed: number }> {
  if (!isWebPushConfigured(env)) return { ok: true, attempted: 0, delivered: 0, deactivated: 0, failed: 0 };

  const nowISO = new Date().toISOString();
  const rows = await sql<
    {
      id: string;
      endpoint: string;
      subscription_json: string;
      failure_count: number;
      next_attempt_at_iso: string | null;
    }[]
  >`
    SELECT id, endpoint, subscription_json, failure_count, next_attempt_at_iso
    FROM web_push_subscriptions
    WHERE user_id=${userId} AND is_active=TRUE
      AND (next_attempt_at_iso IS NULL OR next_attempt_at_iso <= ${nowISO})
    ORDER BY updated_at_iso DESC
    LIMIT 50
  `;

  let attempted = 0;
  let delivered = 0;
  let deactivated = 0;
  let failed = 0;

  const vapid = getVapid(env);

  for (const r of rows) {
    attempted++;
    let sub: WebPushSubscription;
    try {
      sub = JSON.parse(String(r.subscription_json)) as WebPushSubscription;
    } catch {
      failed++;
      await sql`
        UPDATE web_push_subscriptions
        SET is_active=FALSE, last_error=${'invalid_subscription_json'}, updated_at_iso=${nowISO}
        WHERE id=${r.id} AND user_id=${userId}
      `;
      deactivated++;
      continue;
    }

    try {
      const { url, init } = await buildWebPushRequest(sub, vapid, {
        data: message.data,
        ttl: message.options?.ttl,
      });
      const res = await fetch(url, init);

      if (res.status >= 200 && res.status < 300) {
        delivered++;
        await sql`
          UPDATE web_push_subscriptions
          SET failure_count=0,
              next_attempt_at_iso=NULL,
              last_error=NULL,
              last_success_at_iso=${nowISO},
              updated_at_iso=${nowISO}
          WHERE id=${r.id} AND user_id=${userId}
        `;
        continue;
      }

      if (res.status === 404 || res.status === 410) {
        deactivated++;
        await sql`
          UPDATE web_push_subscriptions
          SET is_active=FALSE,
              failure_count=failure_count+1,
              next_attempt_at_iso=NULL,
              last_error=${'expired_' + String(res.status)},
              updated_at_iso=${nowISO}
          WHERE id=${r.id} AND user_id=${userId}
        `;
        continue;
      }

      failed++;
      const nextISO = backoffNextAttemptISO(nowISO, (r.failure_count ?? 0) + 1);
      await sql`
        UPDATE web_push_subscriptions
        SET failure_count=failure_count+1,
            next_attempt_at_iso=${nextISO},
            last_error=${'http_' + String(res.status)},
            updated_at_iso=${nowISO}
        WHERE id=${r.id} AND user_id=${userId}
      `;
    } catch (e: any) {
      failed++;
      const nextISO = backoffNextAttemptISO(nowISO, (r.failure_count ?? 0) + 1);
      await sql`
        UPDATE web_push_subscriptions
        SET failure_count=failure_count+1,
            next_attempt_at_iso=${nextISO},
            last_error=${String(e?.message ?? e)},
            updated_at_iso=${nowISO}
        WHERE id=${r.id} AND user_id=${userId}
      `;
    }
  }

  return { ok: true, attempted, delivered, deactivated, failed };
}
