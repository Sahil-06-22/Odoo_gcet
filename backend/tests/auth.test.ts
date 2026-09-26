import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, resetDb, signup, uid } from './helpers.js';

beforeAll(resetDb);

describe('signup / login', () => {
  it('signs up, rejects duplicates, validates input', async () => {
    const s = await signup('INVENTORY_MANAGER');
    expect(s.user.role).toBe('INVENTORY_MANAGER');
    expect(s.token).toBeTruthy();

    const dup = await api().post('/api/auth/signup').send({ name: 'x', email: s.user.email, password: 'password123' });
    expect(dup.status).toBe(409);

    const bad = await api().post('/api/auth/signup').send({ name: '', email: 'nope', password: 'short' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.length).toBeGreaterThan(0);
  });

  it('logs in with the right password only, with the same error for unknown email', async () => {
    const s = await signup();
    expect((await api().post('/api/auth/login').send({ email: s.user.email, password: s.password })).status).toBe(200);
    const wrong = await api().post('/api/auth/login').send({ email: s.user.email, password: 'wrongpass1' });
    const unknown = await api().post('/api/auth/login').send({ email: `nobody-${uid()}@x.io`, password: 'wrongpass1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('protects API routes and rejects garbage tokens', async () => {
    expect((await api().get('/api/products')).status).toBe(401);
    expect((await api().get('/api/products').set('Authorization', 'Bearer not.a.jwt')).status).toBe(401);
  });

  it('never returns the password hash', async () => {
    const s = await signup();
    const me = await api().get('/api/users/me').set(auth(s));
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|password/i);
  });
});

describe('refresh tokens', () => {
  it('rotates, allows a brief reuse, and dies on logout', async () => {
    const s = await signup();
    const first = await api().post('/api/auth/refresh').set('Cookie', s.cookie);
    expect(first.status).toBe(200);
    const newCookie = (first.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect(newCookie).not.toBe(s.cookie);

    // A reload racing the cookie update presents the old token: still fine inside the reuse window.
    expect((await api().post('/api/auth/refresh').set('Cookie', s.cookie)).status).toBe(200);

    await api().post('/api/auth/logout').set('Cookie', newCookie).expect(204);
    expect((await api().post('/api/auth/refresh').set('Cookie', newCookie)).status).toBe(401);
  });

  it('rejects a missing or made-up refresh token', async () => {
    expect((await api().post('/api/auth/refresh')).status).toBe(401);
    expect((await api().post('/api/auth/refresh').set('Cookie', 'ss_refresh=made-up')).status).toBe(401);
  });

  it('sets the cookie httpOnly and scoped to /api/auth', async () => {
    const s = await signup();
    const res = await api().post('/api/auth/login').send({ email: s.user.email, password: s.password });
    const c = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/Path=\/api\/auth/);
  });
});

describe('OTP password reset', () => {
  it('resets with a valid OTP, once, and signs out other sessions', async () => {
    const s = await signup();
    const fp = await api().post('/api/auth/forgot-password').send({ email: s.user.email });
    expect(fp.status).toBe(200);
    const otp = fp.body.devOtp as string; // no SMTP in tests, so the OTP comes back in the response
    expect(otp).toMatch(/^\d{6}$/);

    expect((await api().post('/api/auth/verify-otp').send({ email: s.user.email, otp })).body.valid).toBe(true);
    const reset = await api().post('/api/auth/reset-password').send({ email: s.user.email, otp, newPassword: 'newpassword1' });
    expect(reset.status).toBe(200);

    expect((await api().post('/api/auth/reset-password').send({ email: s.user.email, otp, newPassword: 'another1234' })).status).toBe(400);
    expect((await api().post('/api/auth/login').send({ email: s.user.email, password: s.password })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: s.user.email, password: 'newpassword1' })).status).toBe(200);
    expect((await api().post('/api/auth/refresh').set('Cookie', s.cookie)).status).toBe(401); // old sessions revoked
  });

  it('locks the OTP after 5 wrong guesses, even if the next guess is right', async () => {
    const s = await signup();
    const { body } = await api().post('/api/auth/forgot-password').send({ email: s.user.email });
    const wrong = body.devOtp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect((await api().post('/api/auth/verify-otp').send({ email: s.user.email, otp: wrong })).status).toBe(400);
    }
    const right = await api().post('/api/auth/verify-otp').send({ email: s.user.email, otp: body.devOtp });
    expect(right.status).toBe(400);
  });

  it('a new request replaces the previous OTP', async () => {
    const s = await signup();
    const a = (await api().post('/api/auth/forgot-password').send({ email: s.user.email })).body.devOtp;
    const b = (await api().post('/api/auth/forgot-password').send({ email: s.user.email })).body.devOtp;
    if (a !== b) expect((await api().post('/api/auth/verify-otp').send({ email: s.user.email, otp: a })).status).toBe(400);
    expect((await api().post('/api/auth/verify-otp').send({ email: s.user.email, otp: b })).status).toBe(200);
  });

  it('answers the same for unknown emails (no account enumeration)', async () => {
    const res = await api().post('/api/auth/forgot-password').send({ email: `ghost-${uid()}@x.io` });
    expect(res.status).toBe(200);
    expect(res.body.devOtp).toBeUndefined();
  });

  it('enforces the new password rules', async () => {
    const s = await signup();
    const { body } = await api().post('/api/auth/forgot-password').send({ email: s.user.email });
    const res = await api().post('/api/auth/reset-password').send({ email: s.user.email, otp: body.devOtp, newPassword: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('profile', () => {
  it('updates the name and changes the password with the current one', async () => {
    const s = await signup();
    const upd = await api().patch('/api/users/me').set(auth(s)).send({ name: 'New Name' });
    expect(upd.body.name).toBe('New Name');

    expect((await api().post('/api/users/me/password').set(auth(s)).send({ currentPassword: 'wrongwrong', newPassword: 'brandnew123' })).status).toBe(400);
    expect((await api().post('/api/users/me/password').set(auth(s)).send({ currentPassword: s.password, newPassword: 'brandnew123' })).status).toBe(204);
    expect((await api().post('/api/auth/login').send({ email: s.user.email, password: 'brandnew123' })).status).toBe(200);
  });
});
