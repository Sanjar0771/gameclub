import type { FastifyInstance } from 'fastify';
import {
  prisma,
  PartnerStatus,
  WithdrawalStatus,
  PaymentStatus,
  BookingStatus,
  ComplaintStatus,
  Role,
} from '@gameclub/db';
import { MIN_COMMISSION_PCT, MAX_COMMISSION_PCT } from '@gameclub/shared';
import { requireRole } from '../middleware.js';
import { audit } from '../../lib/audit.js';
import { sendBookingConfirmedWithQr, notifyUser } from '../../services/notifications.js';
import { hashPassword } from './auth.js';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('SUPER_ADMIN', 'PRE_ADMIN'));

  const isSuper = (req: any) => req.user?.role === 'SUPER_ADMIN';

  // === Statistika dashboard ===
  app.get('/stats', async (req) => {
    const q = req.query as { from?: string; to?: string };
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = q.to ? new Date(q.to) : new Date();

    const [totalCustomers, totalPartners, totalBranches, totalBookings, recentBookings] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.partner.count({ where: { status: PartnerStatus.APPROVED } }),
      prisma.branch.count({ where: { status: 'ACTIVE' } }),
      prisma.booking.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.COMPLETED, BookingStatus.ACTIVE, BookingStatus.NO_SHOW] },
          startAt: { gte: from, lte: to },
        },
        select: { totalAmount: true, commissionAmount: true, startAt: true, branchId: true },
      }),
    ]);

    // Faqat super-admin daromad statistikasini ko'radi
    const showFinance = isSuper(req);
    const totalRevenue = showFinance ? recentBookings.reduce((s, b) => s + b.totalAmount, 0) : null;
    const totalCommission = showFinance
      ? recentBookings.reduce((s, b) => s + b.commissionAmount, 0)
      : null;

    // Kunlik
    const byDay: Record<string, { bookings: number; commission: number }> = {};
    for (const b of recentBookings) {
      const key = b.startAt.toISOString().slice(0, 10);
      if (!byDay[key]) byDay[key] = { bookings: 0, commission: 0 };
      byDay[key].bookings += 1;
      byDay[key].commission += b.commissionAmount;
    }

    // Top branches
    const branchTotals: Record<string, { count: number; commission: number }> = {};
    for (const b of recentBookings) {
      if (!branchTotals[b.branchId]) branchTotals[b.branchId] = { count: 0, commission: 0 };
      branchTotals[b.branchId]!.count += 1;
      branchTotals[b.branchId]!.commission += b.commissionAmount;
    }
    const branchIds = Object.keys(branchTotals);
    const branchInfo = await prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, city: true },
    });
    const topBranches = branchInfo
      .map((bi) => ({
        ...bi,
        bookings: branchTotals[bi.id]?.count ?? 0,
        commission: showFinance ? branchTotals[bi.id]?.commission ?? 0 : null,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10);

    return {
      ok: true,
      data: {
        totals: {
          customers: totalCustomers,
          partners: totalPartners,
          branches: totalBranches,
          bookings: totalBookings,
          revenue: totalRevenue,
          commission: totalCommission,
        },
        byDay: Object.entries(byDay).map(([date, v]) => ({
          date,
          bookings: v.bookings,
          commission: showFinance ? v.commission : null,
        })),
        topBranches,
      },
    };
  });

  // === Kutilayotgan hamkor arizalari ===
  app.get('/partners/pending', async () => {
    const partners = await prisma.partner.findMany({
      where: { status: PartnerStatus.PENDING },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ok: true,
      data: partners.map((p) => ({
        ...p,
        user: { ...p.user, telegramId: p.user.telegramId.toString() },
      })),
    };
  });

  app.get('/partners', async (req) => {
    const q = req.query as { status?: string };
    const where: any = {};
    if (q.status) where.status = q.status;
    const partners = await prisma.partner.findMany({
      where,
      include: {
        user: true,
        branches: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      ok: true,
      data: partners.map((p) => ({
        ...p,
        user: { ...p.user, telegramId: p.user.telegramId.toString() },
      })),
    };
  });

  // === Hamkorni tasdiqlash ===
  app.post('/partners/:id/approve', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    console.log(`[approve] Partner ${id} tasdiqlash — user: ${userCtx?.userId}, role: ${userCtx?.role}`);
    const partner = await prisma.partner.findUnique({ where: { id }, include: { user: true } });
    if (!partner) {
      console.log(`[approve] Partner ${id} topilmadi`);
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }

    await prisma.partner.update({
      where: { id },
      data: {
        status: PartnerStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: userCtx.userId,
      },
    });

    await audit({
      actorId: userCtx.userId,
      actorRole: userCtx.role,
      action: 'PARTNER_APPROVED',
      targetType: 'Partner',
      targetId: id,
    });

    // Notification xatosi bo'lsa ham tasdiqlash muvaffaqiyatli bo'lishi kerak
    try {
      await notifyUser({
        userId: partner.userId,
        type: 'PARTNER_APPROVED',
        titleUz: '🎉 Tabriklaymiz!',
        titleRu: '🎉 Поздравляем!',
        bodyUz: 'Sizning hamkor sifatidagi arizangiz tasdiqlandi. Endi filial qo\'shing!',
        bodyRu: 'Ваша заявка партнёра одобрена. Теперь добавьте филиал!',
      });
    } catch (e) {
      // Notification xatosi — log qilamiz lekin approve muvaffaqiyatli
      console.error('Partner approval notification failed:', e);
    }

    return { ok: true, data: { approved: true } };
  });

  // === Hamkorni rad etish ===
  app.post('/partners/:id/reject', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string };
    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });

    await prisma.partner.update({
      where: { id },
      data: {
        status: PartnerStatus.REJECTED,
        rejectReason: body?.reason ?? 'Sabab ko\'rsatilmagan',
      },
    });

    await audit({
      actorId: userCtx.userId,
      actorRole: userCtx.role,
      action: 'PARTNER_REJECTED',
      targetType: 'Partner',
      targetId: id,
      metadata: { reason: body?.reason },
    });

    try {
      await notifyUser({
        userId: partner.userId,
        type: 'PARTNER_REJECTED',
        titleUz: '❌ Ariza rad etildi',
        titleRu: '❌ Заявка отклонена',
        bodyUz: `Sabab: ${body?.reason ?? 'ko\'rsatilmagan'}`,
        bodyRu: `Причина: ${body?.reason ?? 'не указана'}`,
      });
    } catch (e) {
      console.error('Partner rejection notification failed:', e);
    }

    return { ok: true, data: { rejected: true } };
  });

  // === Hamkorni bloklash ===
  app.post('/partners/:id/ban', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string };
    await prisma.partner.update({
      where: { id },
      data: {
        status: PartnerStatus.BANNED,
        bannedAt: new Date(),
        banReason: body?.reason,
      },
    });
    await audit({
      actorId: userCtx.userId,
      actorRole: userCtx.role,
      action: 'PARTNER_BANNED',
      targetType: 'Partner',
      targetId: id,
    });
    return { ok: true, data: { banned: true } };
  });

  // === Filial komissiya foizini o'zgartirish (faqat super-admin) ===
  app.patch('/branches/:id/commission', async (req, reply) => {
    if (!isSuper(req)) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    }
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { commissionPct?: number };
    if (
      typeof body?.commissionPct !== 'number' ||
      body.commissionPct < MIN_COMMISSION_PCT ||
      body.commissionPct > MAX_COMMISSION_PCT
    ) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: `Komissiya ${MIN_COMMISSION_PCT}-${MAX_COMMISSION_PCT}% oralig'ida bo'lishi kerak` },
      });
    }
    const branch = await prisma.branch.update({
      where: { id },
      data: { commissionPct: body.commissionPct as any },
    });
    await audit({
      actorId: userCtx.userId,
      actorRole: 'SUPER_ADMIN',
      action: 'COMMISSION_CHANGED',
      targetType: 'Branch',
      targetId: id,
      metadata: { commissionPct: body.commissionPct },
    });
    return { ok: true, data: branch };
  });

  // === To'lov cheklarini ko'rish (PAYMENT_REVIEW status) ===
  app.get('/payments/pending', async () => {
    const payments = await prisma.payment.findMany({
      where: { status: PaymentStatus.RECEIPT_UPLOADED },
      include: {
        booking: {
          include: {
            customer: { select: { firstName: true, telegramId: true } },
            branch: { select: { name: true, cardNumber: true } },
            computer: { select: { name: true } },
          },
        },
      },
      orderBy: { uploadedAt: 'asc' },
      take: 100,
    });
    return {
      ok: true,
      data: payments.map((p) => ({
        ...p,
        booking: {
          ...p.booking,
          customer: { ...p.booking.customer, telegramId: p.booking.customer.telegramId.toString() },
        },
      })),
    };
  });

  // === To'lovni tasdiqlash (faqat super-admin) ===
  app.post('/payments/:id/confirm', async (req, reply) => {
    if (!isSuper(req)) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    }
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const payment = await prisma.payment.findUnique({ where: { id }, include: { booking: true } });
    if (!payment) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.CONFIRMED,
          confirmedAt: new Date(),
          confirmedBy: userCtx.userId,
        },
      });
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CONFIRMED },
      });
    });

    // QR kod yuborish (bot orqali rasm)
    try {
      await sendBookingConfirmedWithQr(payment.bookingId);
    } catch (e) {
      console.error('QR notification failed:', e);
    }

    await audit({
      actorId: userCtx.userId,
      actorRole: 'SUPER_ADMIN',
      action: 'PAYMENT_CONFIRMED',
      targetType: 'Payment',
      targetId: id,
    });

    return { ok: true, data: { confirmed: true } };
  });

  app.post('/payments/:id/reject', async (req, reply) => {
    if (!isSuper(req)) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    }
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string };
    const payment = await prisma.payment.findUnique({ where: { id }, include: { booking: { include: { customer: true } } } });
    if (!payment) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.REJECTED,
          rejectedAt: new Date(),
          rejectReason: body?.reason,
        },
      });
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.PENDING_PAYMENT },
      });
    });

    try {
      await notifyUser({
        userId: payment.booking.customer.id,
        type: 'PAYMENT_REJECTED',
        titleUz: '❌ Chek qabul qilinmadi',
        titleRu: '❌ Чек не принят',
        bodyUz: `Sabab: ${body?.reason ?? 'ko\'rsatilmagan'}. Iltimos, chekni qaytadan yuboring.`,
        bodyRu: `Причина: ${body?.reason ?? 'не указана'}. Пожалуйста, отправьте чек повторно.`,
      });
    } catch (e) {
      console.error('Payment rejection notification failed:', e);
    }

    return { ok: true, data: { rejected: true } };
  });

  // === Yechib olish so'rovlari ===
  app.get('/withdrawals', async (req) => {
    const q = req.query as { status?: string };
    const where: any = {};
    if (q.status) where.status = q.status;
    const ws = await prisma.withdrawal.findMany({
      where,
      include: {
        branch: { include: { partner: { include: { user: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return {
      ok: true,
      data: ws.map((w) => ({
        ...w,
        branch: {
          ...w.branch,
          partner: {
            ...w.branch.partner,
            user: { ...w.branch.partner.user, telegramId: w.branch.partner.user.telegramId.toString() },
          },
        },
      })),
    };
  });

  app.post('/withdrawals/:id/complete', async (req, reply) => {
    if (!isSuper(req)) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    }
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const w = await prisma.withdrawal.findUnique({ where: { id }, include: { branch: { include: { partner: true } } } });
    if (!w) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.COMPLETED,
          processedAt: new Date(),
          processedBy: userCtx.userId,
        },
      });
      await tx.balance.update({
        where: { branchId: w.branchId },
        data: { totalWithdrawn: { increment: w.amount } },
      });
    });

    try {
      await notifyUser({
        userId: w.branch.partner.userId,
        type: 'WITHDRAWAL_PROCESSED',
        titleUz: '✅ Pul o\'tkazildi',
        titleRu: '✅ Деньги переведены',
        bodyUz: `${w.amount} so'm sizning kartangizga o'tkazildi.`,
        bodyRu: `${w.amount} сум переведено на вашу карту.`,
      });
    } catch (e) {
      console.error('Withdrawal notification failed:', e);
    }

    return { ok: true, data: { completed: true } };
  });

  app.post('/withdrawals/:id/reject', async (req, reply) => {
    if (!isSuper(req)) {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    }
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string };
    const w = await prisma.withdrawal.findUnique({ where: { id } });
    if (!w) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.REJECTED,
          processedBy: userCtx.userId,
          processedAt: new Date(),
          rejectReason: body?.reason,
        },
      });
      // Pulni balansiga qaytarish
      await tx.balance.update({
        where: { branchId: w.branchId },
        data: { amount: { increment: w.amount } },
      });
    });
    return { ok: true, data: { rejected: true } };
  });

  // === Shikoyatlar ===
  app.get('/complaints', async (req) => {
    const q = req.query as { status?: string };
    const where: any = {};
    if (q.status) where.status = q.status;
    const items = await prisma.complaint.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, telegramId: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      ok: true,
      data: items.map((i) => ({
        ...i,
        customer: { ...i.customer, telegramId: i.customer.telegramId.toString() },
      })),
    };
  });

  app.patch('/complaints/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { status?: ComplaintStatus; resolution?: string };
    const c = await prisma.complaint.update({
      where: { id },
      data: {
        status: body.status,
        resolution: body.resolution,
        resolvedBy: body.status === ComplaintStatus.RESOLVED ? userCtx.userId : undefined,
        resolvedAt: body.status === ComplaintStatus.RESOLVED ? new Date() : undefined,
      },
    });
    return { ok: true, data: c };
  });

  // === Pre-adminlar (faqat super-admin) ===
  app.get('/pre-admins', async (req, reply) => {
    if (!isSuper(req)) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    const items = await prisma.preAdmin.findMany({
      include: { user: true, watchedBranches: { include: { branch: { select: { name: true } } } } },
    });
    return {
      ok: true,
      data: items.map((i) => ({
        ...i,
        user: { ...i.user, telegramId: i.user.telegramId.toString() },
      })),
    };
  });

  app.post('/pre-admins', async (req, reply) => {
    if (!isSuper(req)) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    const body = req.body as { telegramId?: string | number; login?: string; password?: string; firstName?: string };
    if (!body?.telegramId || !body?.login || !body?.password) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'telegramId, login, password kerak' } });
    }
    const hash = hashPassword(body.password);

    const tgId = BigInt(body.telegramId);
    let user = await prisma.user.findUnique({ where: { telegramId: tgId } });
    if (!user) {
      user = await prisma.user.create({
        data: { telegramId: tgId, firstName: body.firstName, role: Role.PRE_ADMIN },
      });
    } else if (user.role !== Role.PRE_ADMIN) {
      await prisma.user.update({ where: { id: user.id }, data: { role: Role.PRE_ADMIN } });
    }
    const userCtx = (req as any).user;
    const pa = await prisma.preAdmin.create({
      data: {
        userId: user.id,
        login: body.login,
        passwordHash: hash,
        createdBy: userCtx.userId,
      },
    });
    return { ok: true, data: pa };
  });

  app.delete('/pre-admins/:id', async (req, reply) => {
    if (!isSuper(req)) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    const { id } = req.params as { id: string };
    const pa = await prisma.preAdmin.findUnique({ where: { id } });
    if (!pa) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    await prisma.preAdmin.delete({ where: { id } });
    await prisma.user.update({ where: { id: pa.userId }, data: { role: Role.CUSTOMER } });
    return { ok: true, data: { deleted: true } };
  });

  // === Bot matnlari ===
  app.get('/bot-texts', async () => {
    const items = await prisma.botText.findMany();
    return { ok: true, data: items };
  });

  app.patch('/bot-texts/:key', async (req, reply) => {
    if (!isSuper(req)) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    const { key } = req.params as { key: string };
    const body = req.body as { textUz?: string; textRu?: string };
    const userCtx = (req as any).user;
    const item = await prisma.botText.update({
      where: { key },
      data: {
        textUz: body.textUz,
        textRu: body.textRu,
        updatedBy: userCtx.userId,
      },
    });
    return { ok: true, data: item };
  });

  // === Broadcast ===
  app.post('/broadcasts', async (req, reply) => {
    if (!isSuper(req)) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    const userCtx = (req as any).user;
    const body = req.body as { title?: string; messageUz?: string; messageRu?: string; audience?: string };
    if (!body?.title || !body?.messageUz || !body?.messageRu) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'title, messageUz, messageRu kerak' } });
    }
    const b = await prisma.broadcast.create({
      data: {
        title: body.title,
        messageUz: body.messageUz,
        messageRu: body.messageRu,
        audience: body.audience ?? 'ALL',
        sentBy: userCtx.userId,
        status: 'DRAFT',
      },
    });
    return { ok: true, data: b };
  });

  app.post('/broadcasts/:id/send', async (req, reply) => {
    if (!isSuper(req)) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Faqat super-admin' } });
    const { id } = req.params as { id: string };
    const b = await prisma.broadcast.findUnique({ where: { id } });
    if (!b) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });

    // Asinx yuborish — background'da ishlasin
    void runBroadcast(id);
    return { ok: true, data: { sending: true } };
  });

  // === Audit log ===
  app.get('/audit-logs', async (req) => {
    const q = req.query as { action?: string; targetType?: string; limit?: string };
    const limit = Math.min(Number(q.limit ?? '50'), 200);
    const where: any = {};
    if (q.action) where.action = q.action;
    if (q.targetType) where.targetType = q.targetType;
    const items = await prisma.auditLog.findMany({
      where,
      include: { actor: { select: { firstName: true, role: true, telegramId: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return {
      ok: true,
      data: items.map((i) => ({
        ...i,
        actor: i.actor ? { ...i.actor, telegramId: i.actor.telegramId.toString() } : null,
      })),
    };
  });
}

async function runBroadcast(broadcastId: string) {
  const { bot } = await import('../../bot/index.js');
  const b = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!b) return;

  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'SENDING' } });

  let where: any = { isActive: true };
  if (b.audience === 'CUSTOMERS') where.role = Role.CUSTOMER;
  if (b.audience === 'PARTNERS') where.role = Role.PARTNER;

  const users = await prisma.user.findMany({ where, select: { telegramId: true, language: true } });
  let sent = 0;
  let failed = 0;
  for (const u of users) {
    const msg = u.language === 'UZ' ? b.messageUz : b.messageRu;
    try {
      await bot.api.sendMessage(u.telegramId.toString(), `📢 ${b.title}\n\n${msg}`, {
        parse_mode: 'HTML',
      });
      sent += 1;
    } catch {
      failed += 1;
    }
    // Telegram rate limit (max 30/sec)
    await new Promise((r) => setTimeout(r, 40));
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'SENT', sentAt: new Date(), sentCount: sent, failedCount: failed },
  });
}
