import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { config, isProd } from '../config.js';
import { log } from '../lib/logger.js';

import { authRoutes } from './routes/auth.js';
import { customerRoutes } from './routes/customer.js';
import { partnerRoutes } from './routes/partner.js';
import { assistantRoutes } from './routes/assistant.js';
import { adminRoutes } from './routes/admin.js';
import { commonRoutes } from './routes/common.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      telegramId: string;
      role: string;
    };
    user: {
      userId: string;
      telegramId: string;
      role: string;
    };
  }
}

export async function buildApi(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: !isProd,
    bodyLimit: 10 * 1024 * 1024, // 10MB
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: isProd ? [config.WEBAPP_URL] : true,
    credentials: true,
  });
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB chek rasmi
  });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // Health check (Railway uchun ham)
  app.get('/health', async () => ({ ok: true, ts: Date.now() }));
  app.get('/api/health', async () => ({ ok: true, ts: Date.now() }));

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(commonRoutes, { prefix: '/api/common' });
  await app.register(customerRoutes, { prefix: '/api/customer' });
  await app.register(partnerRoutes, { prefix: '/api/partner' });
  await app.register(assistantRoutes, { prefix: '/api/assistant' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  // 404
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Error handler
  app.setErrorHandler((err, req, reply) => {
    log.error(`API xato: ${req.method} ${req.url}`, err);
    const statusCode = err.statusCode ?? 500;
    reply.code(statusCode).send({
      ok: false,
      error: {
        code: err.code ?? 'INTERNAL',
        message: err.message ?? 'Internal error',
      },
    });
  });

  return app;
}

export async function startApi(): Promise<FastifyInstance> {
  const app = await buildApi();
  await app.listen({ port: config.API_PORT, host: config.API_HOST });
  log.info(`🚀 API server: http://${config.API_HOST}:${config.API_PORT}`);
  return app;
}
