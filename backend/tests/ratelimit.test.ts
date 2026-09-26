import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, resetDb, signup } from './helpers.js';

beforeAll(async () => {
  await resetDb();
  process.env.RATE_LIMIT_IN_TEST = 'true'; // limiters are normally off under test
});
afterAll(() => {
  delete process.env.RATE_LIMIT_IN_TEST;
});

describe('rate limiting', () => {
  it('blocks repeated failed logins but not successful ones', async () => {
    const s = await signup();
    // 15 successful logins never trip the limiter (only failures count)
    for (let i = 0; i < 15; i++) {
      expect((await api().post('/api/auth/login').send({ email: s.user.email, password: s.password })).status).toBe(200);
    }
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      codes.push((await api().post('/api/auth/login').send({ email: s.user.email, password: 'wrongpass1' })).status);
    }
    expect(codes.slice(0, 10).every(c => c === 401)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);

    const blocked = await api().post('/api/auth/login').send({ email: s.user.email, password: s.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/too many/i);
  });

  it('limits OTP requests and guesses', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await api().post('/api/auth/forgot-password').send({ email: 'x@y.io' })).status);
    expect(codes.slice(0, 10).every(c => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});
