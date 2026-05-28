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

  // Dev: hamkorlar va foydalanuvchilarni boshqarish (secret bilan himoyalangan)
  app.post('/api/dev/approve-pending', async (req, reply) => {
    const body = req.body as { secret?: string };
    if (body?.secret !== config.BOT_TOKEN) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Invalid secret' } });
    }
    const { prisma, PartnerStatus } = await import('@gameclub/db');
    const pending = await prisma.partner.findMany({ where: { status: PartnerStatus.PENDING } });
    for (const p of pending) {
      await prisma.partner.update({
        where: { id: p.id },
        data: { status: PartnerStatus.APPROVED, approvedAt: new Date() },
      });
    }
    return { ok: true, data: { approved: pending.length } };
  });

  app.post('/api/dev/partners-info', async (req, reply) => {
    const body = req.body as { secret?: string };
    if (body?.secret !== config.BOT_TOKEN) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Invalid secret' } });
    }
    const { prisma } = await import('@gameclub/db');
    const partners = await prisma.partner.findMany({
      include: { user: { select: { telegramId: true, role: true, firstName: true } } },
    });
    const users = await prisma.user.findMany({
      where: { role: { in: ['PARTNER', 'SUPER_ADMIN', 'PRE_ADMIN'] } },
      select: { id: true, telegramId: true, role: true, firstName: true },
    });
    return {
      ok: true,
      data: {
        partners: partners.map((p) => ({
          id: p.id,
          status: p.status,
          fullName: p.fullName,
          telegramId: p.user.telegramId.toString(),
          userRole: p.user.role,
        })),
        users: users.map((u) => ({
          id: u.id,
          telegramId: u.telegramId.toString(),
          role: u.role,
          firstName: u.firstName,
        })),
      },
    };
  });

  // Dev: test balans qo'shish
  app.post('/api/dev/add-balance', async (req, reply) => {
    const body = req.body as { secret?: string; branchId?: string; amount?: number };
    if (body?.secret !== config.BOT_TOKEN) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Invalid secret' } });
    }
    const { prisma } = await import('@gameclub/db');
    if (body.branchId) {
      await prisma.balance.upsert({
        where: { branchId: body.branchId },
        update: { amount: { increment: body.amount ?? 100000 }, totalEarned: { increment: body.amount ?? 100000 } },
        create: { branchId: body.branchId, amount: body.amount ?? 100000, totalEarned: body.amount ?? 100000 },
      });
      return { ok: true, data: { added: body.amount ?? 100000, branchId: body.branchId } };
    }
    // Hammaga qo'shish
    const branches = await prisma.branch.findMany();
    for (const b of branches) {
      await prisma.balance.upsert({
        where: { branchId: b.id },
        update: { amount: { increment: body.amount ?? 100000 }, totalEarned: { increment: body.amount ?? 100000 } },
        create: { branchId: b.id, amount: body.amount ?? 100000, totalEarned: body.amount ?? 100000 },
      });
    }
    return { ok: true, data: { added: body.amount ?? 100000, branches: branches.length } };
  });

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
  const port = config.PORT ? Number(config.PORT) : config.API_PORT;
  await app.listen({ port, host: config.API_HOST });
  log.info(`🚀 API server: http://${config.API_HOST}:${port}`);
  return app;
}
