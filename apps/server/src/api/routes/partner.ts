import type { FastifyInstance } from 'fastify';
import { prisma, BookingStatus, WithdrawalStatus, ComputerStatus } from '@gameclub/db';
import {
  branchCreateSchema,
  branchUpdateSchema,
  computerTypeSchema,
  computerCreateSchema,
  withdrawalRequestSchema,
  promotionSchema,
  assistantCreateSchema,
  assistantPermissionsSchema,
  MIN_WITHDRAWAL_AMOUNT,
  MAX_ASSISTANTS_PER_BRANCH,
} from '@gameclub/shared';
import { requireRole } from '../middleware.js';
import { audit } from '../../lib/audit.js';
import { verifyQrPayload } from '../../lib/qr.js';
import { config } from '../../config.js';
import { getTelegramFileUrl } from '../../lib/cloudinary.js';

export async function partnerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('PARTNER'));

  // === Mening filiallarim ===
  app.get('/branches', async (req) => {
    const userCtx = (req as any).user;
    const partner = await prisma.partner.findUnique({
      where: { userId: userCtx.userId },
      include: {
        branches: {
          include: {
            images: true,
            computers: { include: { type: true } },
            computerTypes: true,
            balance: true,
            assistants: { include: { user: true } },
          },
        },
      },
    });
    if (!partner) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Hamkor topilmadi' } };
    }
    // BigInt telegramId ni string ga aylantirish (assistants ichida user bor)
    const branches = partner.branches.map((b) => ({
      ...b,
      assistants: b.assistants.map((a) => ({
        ...a,
        user: { ...a.user, telegramId: a.user.telegramId.toString() },
      })),
    }));
    return { ok: true, data: branches };
  });

  // === Filial yaratish ===
  app.post('/branches', async (req, reply) => {
    const userCtx = (req as any).user;
    const parse = branchCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    const partner = await prisma.partner.findUnique({ where: { userId: userCtx.userId } });
    if (!partner || partner.status !== 'APPROVED') {
      return reply.code(403).send({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Avval tasdiqdan o\'ting' },
      });
    }
    const branch = await prisma.branch.create({
      data: {
        partnerId: partner.id,
        ...parse.data,
        commissionPct: 10, // super-admin keyinroq o'zgartiradi
        balance: { create: { amount: 0 } },
      },
    });
    await audit({
      actorId: userCtx.userId,
      actorRole: 'PARTNER',
      action: 'BRANCH_CREATED',
      targetType: 'Branch',
      targetId: branch.id,
    });
    return { ok: true, data: branch };
  });

  // === Filialni yangilash ===
  app.patch('/branches/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const parse = branchUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    await assertOwnsBranch(userCtx.userId, id);
    const branch = await prisma.branch.update({ where: { id }, data: parse.data });
    await audit({
      actorId: userCtx.userId,
      actorRole: 'PARTNER',
      action: 'BRANCH_UPDATED',
      targetType: 'Branch',
      targetId: id,
      metadata: parse.data,
    });
    return { ok: true, data: branch };
  });

  // === Filialni vaqtincha yopish/ochish ===
  app.post('/branches/:id/toggle-status', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { status?: 'ACTIVE' | 'CLOSED'; reason?: string; until?: string };
    await assertOwnsBranch(userCtx.userId, id);
    const branch = await prisma.branch.update({
      where: { id },
      data: {
        status: body.status ?? 'CLOSED',
        closedReason: body.reason,
        closedUntil: body.until ? new Date(body.until) : null,
      },
    });
    return { ok: true, data: branch };
  });

  // === Kompyuter turlari ===
  app.post('/branches/:id/computer-types', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const parse = computerTypeSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    await assertOwnsBranch(userCtx.userId, id);
    const ct = await prisma.computerType.create({
      data: { branchId: id, ...parse.data },
    });
    return { ok: true, data: ct };
  });

  app.patch('/computer-types/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const parse = computerTypeSchema.partial().safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation' },
      });
    }
    const ct = await prisma.computerType.findUnique({ where: { id }, include: { branch: true } });
    if (!ct) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await assertOwnsBranch(userCtx.userId, ct.branchId);
    const updated = await prisma.computerType.update({ where: { id }, data: parse.data });
    return { ok: true, data: updated };
  });

  // === Kompyuter qo'shish ===
  app.post('/branches/:id/computers', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const parse = computerCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    await assertOwnsBranch(userCtx.userId, id);
    try {
      const pc = await prisma.computer.create({
        data: { branchId: id, ...parse.data },
      });
      return { ok: true, data: pc };
    } catch (e: any) {
      if (e.code === 'P2002') {
        return reply.code(409).send({
          ok: false,
          error: { code: 'CONFLICT', message: 'Bu nomli kompyuter mavjud' },
        });
      }
      throw e;
    }
  });

  app.patch('/computers/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; status?: ComputerStatus; brokenReason?: string; typeId?: string };
    const pc = await prisma.computer.findUnique({ where: { id } });
    if (!pc) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await assertOwnsBranch(userCtx.userId, pc.branchId);
    const updated = await prisma.computer.update({ where: { id }, data: body });
    return { ok: true, data: updated };
  });

  app.delete('/computers/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const pc = await prisma.computer.findUnique({ where: { id } });
    if (!pc) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await assertOwnsBranch(userCtx.userId, pc.branchId);
    await prisma.computer.delete({ where: { id } });
    return { ok: true, data: { deleted: true } };
  });

  // === Aksiyalar ===
  app.post('/branches/:id/promotions', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const parse = promotionSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    await assertOwnsBranch(userCtx.userId, id);
    const promo = await prisma.promotion.create({
      data: {
        branchId: id,
        ...parse.data,
        validFrom: new Date(parse.data.validFrom),
        validUntil: new Date(parse.data.validUntil),
      },
    });
    return { ok: true, data: promo };
  });

  // === Bronlar (hamkor filial bo'yicha) ===
  app.get('/branches/:id/bookings', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const q = req.query as { status?: string; from?: string; to?: string };
    await assertOwnsBranch(userCtx.userId, id);
    const where: any = { branchId: id };
    if (q.status) where.status = q.status;
    if (q.from || q.to) {
      where.startAt = {};
      if (q.from) where.startAt.gte = new Date(q.from);
      if (q.to) where.startAt.lte = new Date(q.to);
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, telegramId: true } },
        computer: { include: { type: true } },
        payment: true,
      },
      orderBy: { startAt: 'desc' },
      take: 100,
    });
    return {
      ok: true,
      data: bookings.map((b) => ({
        ...b,
        customer: {
          ...b.customer,
          telegramId: b.customer.telegramId.toString(),
        },
      })),
    };
  });

  // === QR tasdiqlash (hamkor yoki yordamchi tomonidan) ===
  app.post('/qr/confirm', async (req, reply) => {
    const userCtx = (req as any).user;
    const body = req.body as { payload?: string; bookingCode?: string };

    let bookingId: string | null = null;
    if (body.payload) {
      bookingId = verifyQrPayload(body.payload);
    } else if (body.bookingCode) {
      const b = await prisma.booking.findUnique({ where: { code: body.bookingCode } });
      bookingId = b?.id ?? null;
    }
    if (!bookingId) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'QR yoki bron kodi noto\'g\'ri' },
      });
    }
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { branch: { include: { partner: true } } },
    });
    if (!booking) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    if (booking.branch.partner.userId !== userCtx.userId) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Sizning bronyingiz emas' } });
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: `Status: ${booking.status}` },
      });
    }

    // Transaction: bron statusini o'zgartirish + balansga qo'shish
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.ACTIVE,
          qrConfirmedAt: new Date(),
          qrConfirmedBy: userCtx.userId,
        },
      });
      await tx.balance.update({
        where: { branchId: booking.branchId },
        data: {
          amount: { increment: booking.partnerAmount },
          totalEarned: { increment: booking.partnerAmount },
        },
      });
    });

    await audit({
      actorId: userCtx.userId,
      actorRole: 'PARTNER',
      action: 'QR_CONFIRMED',
      targetType: 'Booking',
      targetId: booking.id,
      metadata: { partnerAmount: booking.partnerAmount },
    });

    return { ok: true, data: { confirmed: true, bookingId: booking.id } };
  });

  // === Bronni rad etish (PC buzildi va h.k.) ===
  app.post('/bookings/:id/reject', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string };
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { branch: { include: { partner: true } } },
    });
    if (!booking) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    if (booking.branch.partner.userId !== userCtx.userId) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Sizning bronyingiz emas' } });
    }
    await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.REJECTED_BY_CLUB,
        rejectedAt: new Date(),
        rejectReason: body?.reason ?? 'Hamkor rad etdi',
      },
    });
    // Refund jarayoni — super-admin qo'lda qiladi
    return { ok: true, data: { rejected: true } };
  });

  // === No-show belgilash ===
  app.post('/bookings/:id/no-show', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { branch: { include: { partner: true } } },
    });
    if (!booking) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    if (booking.branch.partner.userId !== userCtx.userId) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Sizning bronyingiz emas' } });
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Status mos kelmaydi' },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
      });
      // No-show da ham pul hamkorga
      await tx.balance.update({
        where: { branchId: booking.branchId },
        data: {
          amount: { increment: booking.partnerAmount },
          totalEarned: { increment: booking.partnerAmount },
        },
      });
    });

    return { ok: true, data: { marked: true } };
  });

  // === Balans ===
  app.get('/balances', async (req) => {
    const userCtx = (req as any).user;
    const partner = await prisma.partner.findUnique({
      where: { userId: userCtx.userId },
      include: { branches: { include: { balance: true } } },
    });
    if (!partner) return { ok: false, error: { code: 'NOT_FOUND', message: 'Hamkor topilmadi' } };
    const total = partner.branches.reduce((s, b) => s + (b.balance?.amount ?? 0), 0);
    return {
      ok: true,
      data: {
        total,
        branches: partner.branches.map((b) => ({
          branchId: b.id,
          branchName: b.name,
          balance: b.balance?.amount ?? 0,
          totalEarned: b.balance?.totalEarned ?? 0,
          totalWithdrawn: b.balance?.totalWithdrawn ?? 0,
        })),
      },
    };
  });

  // === Yechib olish ===
  app.post('/withdrawals', async (req, reply) => {
    const userCtx = (req as any).user;
    const parse = withdrawalRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    if (parse.data.amount < MIN_WITHDRAWAL_AMOUNT) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'VALIDATION',
          message: `Minimal summa ${MIN_WITHDRAWAL_AMOUNT} so'm`,
        },
      });
    }
    await assertOwnsBranch(userCtx.userId, parse.data.branchId);
    const balance = await prisma.balance.findUnique({ where: { branchId: parse.data.branchId } });
    if (!balance || balance.amount < parse.data.amount) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'INSUFFICIENT_BALANCE', message: 'Balans yetarli emas' },
      });
    }
    const branch = await prisma.branch.findUnique({ where: { id: parse.data.branchId } });
    if (!branch) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });

    const w = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.create({
        data: {
          branchId: parse.data.branchId,
          amount: parse.data.amount,
          cardNumber: branch.cardNumber,
          status: WithdrawalStatus.REQUESTED,
        },
      });
      await tx.balance.update({
        where: { branchId: parse.data.branchId },
        data: { amount: { decrement: parse.data.amount } },
      });
      return withdrawal;
    });
    return { ok: true, data: w };
  });

  app.get('/withdrawals', async (req) => {
    const userCtx = (req as any).user;
    const partner = await prisma.partner.findUnique({
      where: { userId: userCtx.userId },
      include: { branches: true },
    });
    if (!partner) return { ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } };
    const branchIds = partner.branches.map((b) => b.id);
    const ws = await prisma.withdrawal.findMany({
      where: { branchId: { in: branchIds } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { ok: true, data: ws };
  });

  // === Statistika ===
  app.get('/stats', async (req) => {
    const userCtx = (req as any).user;
    const q = req.query as { branchId?: string; from?: string; to?: string };
    const partner = await prisma.partner.findUnique({
      where: { userId: userCtx.userId },
      include: { branches: true },
    });
    if (!partner) return { ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } };
    const branchIds = q.branchId ? [q.branchId] : partner.branches.map((b) => b.id);
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = q.to ? new Date(q.to) : new Date();

    const bookings = await prisma.booking.findMany({
      where: {
        branchId: { in: branchIds },
        startAt: { gte: from, lte: to },
        status: { in: [BookingStatus.COMPLETED, BookingStatus.ACTIVE, BookingStatus.NO_SHOW] },
      },
      select: { partnerAmount: true, totalAmount: true, startAt: true, branchId: true, status: true },
    });

    const totalIncome = bookings.reduce((s, b) => s + b.partnerAmount, 0);
    const totalGross = bookings.reduce((s, b) => s + b.totalAmount, 0);
    const totalBookings = bookings.length;

    // Kunlik agregatsiya
    const byDay: Record<string, { income: number; bookings: number }> = {};
    for (const b of bookings) {
      const key = b.startAt.toISOString().slice(0, 10);
      if (!byDay[key]) byDay[key] = { income: 0, bookings: 0 };
      byDay[key].income += b.partnerAmount;
      byDay[key].bookings += 1;
    }

    return {
      ok: true,
      data: {
        totalIncome,
        totalGross,
        totalBookings,
        byDay: Object.entries(byDay).map(([date, v]) => ({ date, ...v })),
        byBranch: branchIds.map((bid) => {
          const items = bookings.filter((b) => b.branchId === bid);
          return {
            branchId: bid,
            branchName: partner.branches.find((b) => b.id === bid)?.name,
            income: items.reduce((s, b) => s + b.partnerAmount, 0),
            bookings: items.length,
          };
        }),
      },
    };
  });

  // === Yordamchilar ===
  app.get('/branches/:id/assistants', async (req) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    await assertOwnsBranch(userCtx.userId, id);
    const assistants = await prisma.assistant.findMany({
      where: { branchId: id },
      include: { user: true },
    });
    return {
      ok: true,
      data: assistants.map((a) => ({
        ...a,
        user: { ...a.user, telegramId: a.user.telegramId.toString() },
      })),
    };
  });

  app.post('/branches/:id/assistants', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const parse = assistantCreateSchema.safeParse({ ...(req.body as object), branchId: id });
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    await assertOwnsBranch(userCtx.userId, id);

    const current = await prisma.assistant.count({ where: { branchId: id } });
    if (current >= MAX_ASSISTANTS_PER_BRANCH) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: `Maksimum ${MAX_ASSISTANTS_PER_BRANCH} ta yordamchi` },
      });
    }

    // Foydalanuvchi mavjudligini tekshirish (yoki yaratish placeholder)
    const tgId = parse.data.telegramId;
    let user = await prisma.user.findUnique({ where: { telegramId: tgId } });
    if (!user) {
      user = await prisma.user.create({
        data: { telegramId: tgId, role: 'ASSISTANT' },
      });
    } else if (user.role !== 'ASSISTANT') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ASSISTANT' } });
    }

    const existing = await prisma.assistant.findUnique({ where: { userId: user.id } });
    if (existing) {
      return reply.code(409).send({
        ok: false,
        error: { code: 'CONFLICT', message: 'Bu foydalanuvchi allaqachon yordamchi' },
      });
    }

    const assistant = await prisma.assistant.create({
      data: {
        userId: user.id,
        branchId: id,
        ...(parse.data.permissions ?? {}),
      },
    });
    return { ok: true, data: assistant };
  });

  app.patch('/assistants/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const parse = assistantPermissionsSchema.partial().safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation' },
      });
    }
    const a = await prisma.assistant.findUnique({ where: { id }, include: { branch: true } });
    if (!a) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await assertOwnsBranch(userCtx.userId, a.branchId);
    const updated = await prisma.assistant.update({ where: { id }, data: parse.data });
    return { ok: true, data: updated };
  });

  // === Filial rasmlari ===
  app.post('/branches/:id/images', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    await assertOwnsBranch(userCtx.userId, id);

    const body = req.body as { url?: string; imageBase64?: string };

    let imageUrl: string | null = null;

    if (body.url) {
      // URL to'g'ridan-to'g'ri berilgan
      imageUrl = body.url;
    } else if (body.imageBase64) {
      // Base64 rasm — Telegram Bot API orqali saqlaymiz
      try {
        const base64Match = body.imageBase64.match(/^data:image\/\w+;base64,(.+)$/);
        const buffer = Buffer.from(base64Match ? base64Match[1] : body.imageBase64, 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Rasm 5MB dan katta' } });
        }

        // Telegram Bot API ga yuborish
        const formData = new FormData();
        formData.append('chat_id', config.SUPER_ADMIN_TELEGRAM_ID.toString());
        formData.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'branch.jpg');
        formData.append('caption', `📷 Branch image: ${id}`);
        formData.append('disable_notification', 'true');

        const sendRes = await fetch(`https://api.telegram.org/bot${config.BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
        const sendData: any = await sendRes.json();

        if (sendData.ok && sendData.result?.photo?.length > 0) {
          const bestPhoto = sendData.result.photo[sendData.result.photo.length - 1];
          imageUrl = await getTelegramFileUrl(bestPhoto.file_id);

          // Xabarni o'chiramiz (spam bo'lmasligi uchun)
          try {
            await fetch(`https://api.telegram.org/bot${config.BOT_TOKEN}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: config.SUPER_ADMIN_TELEGRAM_ID.toString(), message_id: sendData.result.message_id }),
            });
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.error('Image upload error:', e);
        return reply.code(500).send({ ok: false, error: { code: 'UPLOAD_ERROR', message: 'Rasm yuklanmadi' } });
      }
    }

    if (!imageUrl) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'url yoki imageBase64 kerak' } });
    }

    const count = await prisma.branchImage.count({ where: { branchId: id } });
    if (count >= 10) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Maksimum 10 ta rasm' } });
    }

    const img = await prisma.branchImage.create({
      data: { branchId: id, url: imageUrl, order: count },
    });
    return { ok: true, data: img };
  });

  app.delete('/images/:imageId', async (req, reply) => {
    const userCtx = (req as any).user;
    const { imageId } = req.params as { imageId: string };
    const img = await prisma.branchImage.findUnique({ where: { id: imageId }, include: { branch: true } });
    if (!img) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await assertOwnsBranch(userCtx.userId, img.branchId);
    await prisma.branchImage.delete({ where: { id: imageId } });
    return { ok: true, data: { deleted: true } };
  });

  app.delete('/assistants/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const a = await prisma.assistant.findUnique({ where: { id } });
    if (!a) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await assertOwnsBranch(userCtx.userId, a.branchId);
    await prisma.assistant.delete({ where: { id } });
    // Foydalanuvchi rolini CUSTOMER ga qaytarish
    await prisma.user.update({ where: { id: a.userId }, data: { role: 'CUSTOMER' } });
    return { ok: true, data: { deleted: true } };
  });
}

async function assertOwnsBranch(userId: string, branchId: string): Promise<void> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { partner: true },
  });
  if (!branch || branch.partner.userId !== userId) {
    throw Object.assign(new Error('Sizning filialingiz emas'), { statusCode: 403, code: 'FORBIDDEN' });
  }
}
