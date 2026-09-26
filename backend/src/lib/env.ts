import 'dotenv/config';

const required = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var ${key}`);
  return v;
};

const isProd = process.env.NODE_ENV === 'production';

const secret = (key: string): string => {
  const v = required(key);
  if (isProd && (v.startsWith('change-me') || v.length < 32)) {
    throw new Error(`${key} must be a long random string (32+ chars) in production. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`);
  }
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  databaseUrl: required('DATABASE_URL'),
  accessSecret: secret('JWT_ACCESS_SECRET'),
  refreshSecret: secret('JWT_REFRESH_SECRET'),
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  // Set when behind a reverse proxy (e.g. 1) so rate limiting sees the real client IP.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : undefined,
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()),
};
