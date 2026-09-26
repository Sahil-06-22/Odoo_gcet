import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './modules/auth.js';
import { usersRouter } from './modules/users.js';
import { categoriesRouter, productsRouter, stockRouter } from './modules/products.js';
import { warehousesRouter } from './modules/warehouses.js';
import { operationsRouter } from './modules/operations.js';
import { adjustmentsRouter } from './modules/adjustments.js';
import { ledgerRouter } from './modules/ledger.js';
import { dashboardRouter } from './modules/dashboard.js';
import { reorderRouter } from './modules/reorder.js';

export function createApp() {
  const app = express();
  if (env.trustProxy !== undefined) app.set('trust proxy', env.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true, exposedHeaders: ['X-Total-Count'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);

  // Everything below needs a valid access token.
  const api = express.Router();
  api.use(requireAuth);
  api.use('/users', usersRouter);
  api.use('/categories', categoriesRouter);
  api.use('/products', productsRouter);
  api.use('/stock', stockRouter);
  api.use('/warehouses', warehousesRouter);
  api.use('/receipts', operationsRouter('RECEIPT'));
  api.use('/deliveries', operationsRouter('DELIVERY'));
  api.use('/transfers', operationsRouter('TRANSFER'));
  api.use('/adjustments', adjustmentsRouter);
  api.use('/ledger', ledgerRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/reorder', reorderRouter);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
