import { describe, expect, it, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_FILE = './data/test.sqlite';
process.env.ALERT_RUNNER_INTERVAL_SEC = '0';

let app: any;
let token: string;

beforeAll(async () => {
  const mod = await import('../server');
  app = mod.default;
  await app.ready();
  await app.inject({ method: 'POST', url: '/__test/reset' });
  const reg = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: 'sync@example.com', password: 'supersecret1' }
  });
  token = reg.json().token;
});

describe('sync ciphertext envelopes', () => {
  it('uploads and pulls after cursor', async () => {
    const upload = await app.inject({
      method: 'POST',
      url: '/v1/sync/envelopes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        id: 'env_0001',
        deviceId: 'dev_a',
        createdAtISO: '2025-01-01T00:00:00.000Z',
        version: 1,
        kdf: { saltBase64: 'c2FsdA==', iterations: 1000 },
        ciphertextBase64: 'Y2lwaGVydGV4dA==',
        nonceBase64: 'bm9uY2U='
      }
    });
    expect(upload.statusCode).toBe(200);
    expect(upload.json().cursor).toBe(1);

    const pull0 = await app.inject({
      method: 'GET',
      url: '/v1/sync/envelopes?afterCursor=0',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(pull0.statusCode).toBe(200);
    expect(pull0.json().envelopes.length).toBe(1);

    const pull1 = await app.inject({
      method: 'GET',
      url: '/v1/sync/envelopes?afterCursor=1',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(pull1.statusCode).toBe(200);
    expect(pull1.json().envelopes.length).toBe(0);
  });
});
