import type { FastifyInstance } from 'fastify';
import * as crypto from 'node:crypto';
import { prisma } from '@gameclub/db';
import { validateTelegramInitData } from '@gameclub/shared';
import { config } from '../../config.js';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  // Eski format (oddiy SHA-256 — salt siz) bilan backward compatible
  if (!stored.includes(':')) {
    const oldHash = crypto.createHash('sha256').update(password).digest('hex');
    return oldHash === stored;
  }
  const [salt, hash] = stored.split(':');
  const computed = crypto.scryptSync(password, salt!, 64).toString('hex');
  return computed === hash;
}

export async function authRoutes(app: FastifyInstance) {
  /**
   * WebApp dan kirish — initData yuboradi, JWT oladi
   */
  app.post('/telegram', async (req, reply) => {
    const body = req.body as { initData?: string } | undefined;
    const initData = body?.initData ?? (req.headers['x-telegram-init-data'] as string | undefined);

    if (!initData) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'initData required' },
      });
    }

    const result = validateTelegramInitData(initData, config.BOT_TOKEN);
    if (!result.valid || !result.data?.user) {
      return reply.code(401).send({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: result.error ?? 'Invalid initData' },
      });
    }

    const tgUser = result.data.user;
    // Foydalanuvchini yaratish yoki yangilash (bot bilan parallel)
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(tgUser.id),
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          language: tgUser.language_code === 'ru' ? 'RU' : 'UZ',
          role: 'CUSTOMER',
          lastSeenAt: new Date(),
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          lastSeenAt: new Date(),
        },
      });
    }

    // Super-admin tekshiruvi
    if (
      user.role !== 'SUPER_ADMIN' &&
      BigInt(tgUser.id) === config.SUPER_ADMIN_TELEGRAM_ID
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SUPER_ADMIN' },
      });
    }

    const token = app.jwt.sign({
      userId: user.id,
      telegramId: user.telegramId.toString(),
      role: user.role,
    });

    return {
      ok: true,
      data: {
        token,
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          language: user.language,
          role: user.role,
          phone: user.phone,
        },
      },
    };
  });

  /**
   * Super-admin/pre-admin uchun login+parol (qo'shimcha xavfsizlik)
   */
  app.post('/login', async (req, reply) => {
    const body = req.body as { login?: string; password?: string };
    if (!body?.login || !body?.password) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'login va password kerak' },
      });
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { login: body.login },
      include: { user: true },
    });
    if (superAdmin && verifyPassword(body.password, superAdmin.passwordHash)) {
      const token = app.jwt.sign({
        userId: superAdmin.user.id,
        telegramId: superAdmin.user.telegramId.toString(),
        role: 'SUPER_ADMIN',
      });
      return { ok: true, data: { token, role: 'SUPER_ADMIN' } };
    }

    const preAdmin = await prisma.preAdmin.findUnique({
      where: { login: body.login },
      include: { user: true },
    });
    if (preAdmin && verifyPassword(body.password, preAdmin.passwordHash)) {
      const token = app.jwt.sign({
        userId: preAdmin.user.id,
        telegramId: preAdmin.user.telegramId.toString(),
        role: 'PRE_ADMIN',
      });
      return { ok: true, data: { token, role: 'PRE_ADMIN' } };
    }

    return reply.code(401).send({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Login yoki parol noto\'g\'ri' },
    });
  });
}
