import 'dotenv/config';

const required = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var ${key}`);
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  databaseUrl: required('DATABASE_URL'),
  accessSecret: required('JWT_ACCESS_SECRET'),
  refreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()),
};
