import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@gameclub/db';
import { validateTelegramInitData } from '@gameclub/shared';
import { config } from '../config.js';

/**
 * JWT yoki Telegram initData orqali autentifikatsiya.
 * WebApp birinchi kirganda initData yuboradi → JWT oladi.
 * Keyingi so'rovlarda JWT'ni ishlatadi.
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  // 1. JWT'ni tekshirish
  try {
    await req.jwtVerify();
    return;
  } catch {
    // davom etish — initData ham bo'lishi mumkin
  }

  // 2. Telegram initData header
  const initData = req.headers['x-telegram-init-data'];
  if (typeof initData === 'string' && initData.length > 0) {
    const result = validateTelegramInitData(initData, config.BOT_TOKEN);
    if (!result.valid || !result.data?.user) {
      return reply.code(401).send({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid initData' },
      });
    }
    const tgUser = result.data.user;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
    });
    if (!user) {
      return reply.code(401).send({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }
    // req.user'ga qo'shish
    (req as any).user = {
      userId: user.id,
      telegramId: user.telegramId.toString(),
      role: user.role,
    };
    return;
  }

  return reply.code(401).send({
    ok: false,
    error: { code: 'UNAUTHORIZED', message: 'No auth provided' },
  });
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await authenticate(req, reply);
    if (reply.sent) return;
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return reply.code(403).send({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Not enough permissions' },
      });
    }
  };
}
