import { createApp } from './app.js';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { isMailConfigured } from './lib/mail.js';

const server = createApp().listen(env.port, () => {
  console.log(`StockSense API listening on http://localhost:${env.port}/api`);
});

if (env.isProd && !isMailConfigured()) {
  console.warn('WARNING: SMTP_HOST is not set, so password-reset OTPs cannot be emailed (they are only written to this log).');
}

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
