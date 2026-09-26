import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Email is optional. Set SMTP_HOST (plus SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM) to send real mail;
 * without it the OTP only goes to the server console (and back in the API response outside production).
 * Config is read lazily so tests can point it at a local SMTP server.
 */
let cached: Transporter | null | undefined;

function transport(): Transporter | null {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) return (cached = null);
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
  });
  return cached;
}

export const isMailConfigured = () => transport() !== null;

/** For tests: forget the cached transport so the next send re-reads the environment. */
export const resetMailTransport = () => {
  cached = undefined;
};

export async function sendOtpEmail(to: string, otp: string, ttlMinutes: number) {
  const t = transport();
  if (!t) throw new Error('SMTP is not configured');
  await t.sendMail({
    from: process.env.MAIL_FROM ?? 'StockSense <no-reply@stocksense.local>',
    to,
    subject: 'Your StockSense password reset code',
    text: `Your one-time password is ${otp}. It expires in ${ttlMinutes} minutes.\n\nIf you didn't ask to reset your password, you can ignore this email.`,
    html: `<p>Your one-time password is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>It expires in ${ttlMinutes} minutes.</p><p style="color:#666">If you didn't ask to reset your password, you can ignore this email.</p>`,
  });
}
