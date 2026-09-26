import { createApp } from './app.js';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';

const server = createApp().listen(env.port, () => {
  console.log(`StockSense API listening on http://localhost:${env.port}/api`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
