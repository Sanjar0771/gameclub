import type { FastifyInstance } from 'fastify';
import { prisma } from '@gameclub/db';
import { REGIONS } from '@gameclub/shared';
import { authenticate } from '../middleware.js';
import { config } from '../../config.js';

export async function commonRoutes(app: FastifyInstance) {
  // O'zbekiston viloyatlari va shaharlari
  app.get('/regions', async () => {
    return { ok: true, data: REGIONS };
  });

  // Platforma kartasi (to'lov uchun)
  app.get('/payment-card', async () => {
    return {
      ok: true,
      data: {
        cardNumber: config.PLATFORM_CARD_NUMBER ?? null,
        cardHolder: config.PLATFORM_CARD_HOLDER ?? null,
      },
    };
  });

  // Bot matnlari (super-admin tahrirlagan)
  app.get('/bot-texts', async () => {
    const texts = await prisma.botText.findMany();
    return { ok: true, data: texts };
  });

  // Hozirgi foydalanuvchi (me)
  app.get('/me', { preHandler: authenticate }, async (req) => {
    const userCtx = (req as any).user;
    const user = await prisma.user.findUnique({
      where: { id: userCtx.userId },
      include: {
        partner: true,
        assistant: { include: { branch: true } },
      },
    });
    if (!user) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Foydalanuvchi topilmadi' } };
    }
    return {
      ok: true,
      data: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        language: user.language,
        role: user.role,
        partner: user.partner
          ? {
              id: user.partner.id,
              fullName: user.partner.fullName,
              phone: user.partner.phone,
              status: user.partner.status,
            }
          : null,
        assistant: user.assistant
          ? {
              id: user.assistant.id,
              branchId: user.assistant.branchId,
              branchName: user.assistant.branch.name,
            }
          : null,
      },
    };
  });

  // Tilni o'zgartirish
  app.patch('/language', { preHandler: authenticate }, async (req, reply) => {
    const userCtx = (req as any).user;
    const body = req.body as { language?: 'UZ' | 'RU' };
    if (!body?.language || !['UZ', 'RU'].includes(body.language)) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'language UZ yoki RU bo\'lishi kerak' },
      });
    }
    await prisma.user.update({
      where: { id: userCtx.userId },
      data: { language: body.language },
    });
    return { ok: true, data: { language: body.language } };
  });

  // Telefon raqamini yangilash (customer uchun)
  app.patch('/phone', { preHandler: authenticate }, async (req, reply) => {
    const userCtx = (req as any).user;
    const body = req.body as { phone?: string };
    if (!body?.phone || !/^\+?998\d{9}$/.test(body.phone.replace(/\s/g, ''))) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Telefon noto\'g\'ri' },
      });
    }
    const phone = body.phone.replace(/\s/g, '');
    await prisma.user.update({
      where: { id: userCtx.userId },
      data: { phone },
    });
    return { ok: true, data: { phone } };
  });
}
