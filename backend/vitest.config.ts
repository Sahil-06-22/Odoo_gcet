import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Integration tests run against a separate database on the same Postgres server, created and migrated
// automatically by tests/globalSetup.ts. Your dev data is never touched.
const devUrl = process.env.DATABASE_URL ?? 'postgresql://stocksense:stocksense@localhost:5442/stocksense?schema=public';
const testUrl = devUrl.replace(/\/[^/?]+(\?|$)/, '/stocksense_test$1');
process.env.TEST_DATABASE_URL = testUrl;
process.env.ADMIN_DATABASE_URL = devUrl;

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    fileParallelism: false, // files share one database
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testUrl,
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      SMTP_HOST: '', // real email is exercised only in mail.test.ts
    },
  },
});
