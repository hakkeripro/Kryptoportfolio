import { describe, expect, it, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_FILE = './data/test.sqlite';
process.env.ALERT_RUNNER_INTERVAL_SEC = '0';

let app: any;

beforeAll(async () => {
  const mod = await import('../server');
  app = mod.default;
  await app.ready();
  // reset
  await app.inject({ method: 'POST', url: '/__test/reset' });
});

describe('auth', () => {
  it('register + login + me', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'test@example.com', password: 'supersecret1' }
    });
    expect(reg.statusCode).toBe(200);
    const regBody = reg.json();
    expect(regBody.token).toBeTruthy();

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'test@example.com', password: 'supersecret1' }
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().token;

    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('test@example.com');
  });
});
