import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { SMTPServer } from 'smtp-server';
import { resetMailTransport } from '../src/lib/mail.js';
import { api, resetDb, signup } from './helpers.js';

// A throwaway SMTP server on a random port stands in for a real mail provider.
const inbox: { to: string[]; body: string }[] = [];
let server: SMTPServer;

beforeAll(async () => {
  await resetDb();
  server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS', 'AUTH'],
    onRcptTo: (addr, _s, cb) => cb(),
    onData(stream, session, cb) {
      let body = '';
      stream.on('data', c => (body += c));
      stream.on('end', () => {
        inbox.push({ to: session.envelope.rcptTo.map(r => r.address), body });
        cb();
      });
    },
  });
  await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String((server.server.address() as AddressInfo).port);
  process.env.MAIL_FROM = 'StockSense <test@stocksense.local>';
  resetMailTransport();
});

afterAll(async () => {
  process.env.SMTP_HOST = '';
  resetMailTransport();
  await new Promise<void>(res => server.close(() => res()));
});

const waitFor = async (fn: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise(r => setTimeout(r, 50));
};

describe('password-reset email', () => {
  it('emails the OTP and does not leak it in the response', async () => {
    const s = await signup();
    const res = await api().post('/api/auth/forgot-password').send({ email: s.user.email });
    expect(res.status).toBe(200);
    expect(res.body.devOtp).toBeUndefined();

    await waitFor(() => inbox.length > 0);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].to).toEqual([s.user.email]);
    const otp = inbox[0].body.match(/one-time password is (\d{6})/)?.[1];
    expect(otp).toMatch(/^\d{6}$/);

    // ...and the emailed code actually works.
    const reset = await api().post('/api/auth/reset-password').send({ email: s.user.email, otp, newPassword: 'emailedpass1' });
    expect(reset.status).toBe(200);
  });

  it('sends nothing for unknown addresses', async () => {
    const before = inbox.length;
    const res = await api().post('/api/auth/forgot-password').send({ email: 'ghost@nowhere.io' });
    expect(res.status).toBe(200);
    await new Promise(r => setTimeout(r, 300));
    expect(inbox.length).toBe(before);
  });
});
