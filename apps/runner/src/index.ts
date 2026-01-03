export type Env = {
  API_BASE_URL: string;
  CRON_SECRET: string;
  BATCH_LIMIT?: string;
};

function apiUrl(env: Env, path: string): string {
  const base = String(env.API_BASE_URL ?? '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function runOnce(env: Env): Promise<Response> {
  const limit = Number(env.BATCH_LIMIT ?? '200') || 200;
  const url = apiUrl(env, `/v1/alerts/server/runAll?limit=${encodeURIComponent(String(limit))}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.CRON_SECRET}`,
      'content-type': 'application/json'
    }
  });

  return res;
}

export default {
  async scheduled(_event: any, env: Env, ctx: any) {
    ctx.waitUntil(
      (async () => {
        const res = await runOnce(env);
        const body = await res.text();
        console.log(`[runner] status=${res.status} body=${body.slice(0, 1000)}`);
      })()
    );
  },

  // Optional manual trigger for debugging (protects with the same bearer)
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    if (url.pathname === '/run') {
      const auth = req.headers.get('authorization') ?? '';
      const expected = `Bearer ${env.CRON_SECRET}`;
      if (auth !== expected) return new Response('unauthorized', { status: 401 });

      const res = await runOnce(env);
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'content-type': 'application/json' }
      });
    }

    return new Response('not_found', { status: 404 });
  }
};
