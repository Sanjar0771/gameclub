import type { FastifyInstance } from 'fastify';
import { prisma, BookingStatus, ComputerStatus } from '@gameclub/db';
import { computerTypeSchema, computerCreateSchema, promotionSchema } from '@gameclub/shared';
import { requireRole } from '../middleware.js';
import { audit } from '../../lib/audit.js';
import { verifyQrPayload } from '../../lib/qr.js';

export async function assistantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('ASSISTANT'));

  async function getAssistant(userId: string) {
    return prisma.assistant.findUnique({
      where: { userId },
      include: { branch: true },
    });
  }

  // === Mening filialim ===
  app.get('/branch', async (req) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a) return { ok: false, error: { code: 'NOT_FOUND', message: 'Yordamchi topilmadi' } };
    const branch = await prisma.branch.findUnique({
      where: { id: a.branchId },
      include: {
        computers: { include: { type: true } },
        computerTypes: true,
        images: true,
      },
    });
    return {
      ok: true,
      data: {
        branch,
        permissions: {
          canViewBookings: a.canViewBookings,
          canConfirmQr: a.canConfirmQr,
          canRejectBooking: a.canRejectBooking,
          canMarkNoShow: a.canMarkNoShow,
          canManageComputers: a.canManageComputers,
          canChangePrices: a.canChangePrices,
          canChangeWorkHours: a.canChangeWorkHours,
          canCloseBranch: a.canCloseBranch,
          canViewIncome: a.canViewIncome,
          canManagePromotions: a.canManagePromotions,
          canViewComplaints: a.canViewComplaints,
        },
      },
    };
  });

  // === Bronlar ===
  app.get('/bookings', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canViewBookings) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const q = req.query as { status?: string };
    const where: any = { branchId: a.branchId };
    if (q.status) where.status = q.status;
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: { select: { firstName: true, telegramId: true } }, // yordamchi to'liq ID ko'rmaydi
        computer: { include: { type: true } },
      },
      orderBy: { startAt: 'desc' },
      take: 100,
    });
    return {
      ok: true,
      data: bookings.map((b) => ({
        ...b,
        customer: { firstName: b.customer.firstName, customerLabel: `#${b.code}` },
      })),
    };
  });

  // === QR tasdiqlash ===
  app.post('/qr/confirm', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canConfirmQr) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });

    const body = req.body as { payload?: string; bookingCode?: string };
    let bookingId: string | null = null;
    if (body.payload) bookingId = verifyQrPayload(body.payload);
    else if (body.bookingCode) {
      const b = await prisma.booking.findUnique({ where: { code: body.bookingCode } });
      bookingId = b?.id ?? null;
    }
    if (!bookingId) return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'QR noto\'g\'ri' } });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.branchId !== a.branchId) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Status mos kelmaydi' } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACTIVE, qrConfirmedAt: new Date(), qrConfirmedBy: userCtx.userId },
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
      actorRole: 'ASSISTANT',
      action: 'QR_CONFIRMED',
      targetType: 'Booking',
      targetId: booking.id,
    });

    return { ok: true, data: { confirmed: true } };
  });

  // === Bronni rad etish ===
  app.post('/bookings/:id/reject', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canRejectBooking) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string };
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.branchId !== a.branchId) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.REJECTED_BY_CLUB,
        rejectedAt: new Date(),
        rejectReason: body?.reason ?? 'Yordamchi rad etdi',
      },
    });
    await audit({
      actorId: userCtx.userId,
      actorRole: 'ASSISTANT',
      action: 'BOOKING_REJECTED',
      targetType: 'Booking',
      targetId: id,
    });
    return { ok: true, data: { rejected: true } };
  });

  // === No-show ===
  app.post('/bookings/:id/no-show', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canMarkNoShow) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const { id } = req.params as { id: string };
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.branchId !== a.branchId) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Status mos kelmaydi' } });
    }
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
      });
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

  // === Kompyuter qo'shish/tahrirlash ===
  app.post('/computers', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canManageComputers) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const parse = computerCreateSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() } });
    const pc = await prisma.computer.create({
      data: { branchId: a.branchId, ...parse.data },
    });
    await audit({
      actorId: userCtx.userId,
      actorRole: 'ASSISTANT',
      action: 'COMPUTER_CREATED',
      targetType: 'Computer',
      targetId: pc.id,
    });
    return { ok: true, data: pc };
  });

  app.patch('/computers/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canManageComputers) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const { id } = req.params as { id: string };
    const pc = await prisma.computer.findUnique({ where: { id } });
    if (!pc || pc.branchId !== a.branchId) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    const body = req.body as { name?: string; status?: ComputerStatus; brokenReason?: string };
    const updated = await prisma.computer.update({ where: { id }, data: body });
    return { ok: true, data: updated };
  });

  // === Narxlarni o'zgartirish ===
  app.patch('/computer-types/:id', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canChangePrices) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const { id } = req.params as { id: string };
    const parse = computerTypeSchema.partial().safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Validation' } });
    const ct = await prisma.computerType.findUnique({ where: { id } });
    if (!ct || ct.branchId !== a.branchId) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    const updated = await prisma.computerType.update({ where: { id }, data: parse.data });
    await audit({
      actorId: userCtx.userId,
      actorRole: 'ASSISTANT',
      action: 'PRICE_CHANGED',
      targetType: 'ComputerType',
      targetId: id,
      metadata: parse.data,
    });
    return { ok: true, data: updated };
  });

  // === Filialni vaqtincha yopish ===
  app.post('/branch/toggle-status', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canCloseBranch) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const body = req.body as { status?: 'ACTIVE' | 'CLOSED'; reason?: string; until?: string };
    const branch = await prisma.branch.update({
      where: { id: a.branchId },
      data: {
        status: body.status ?? 'CLOSED',
        closedReason: body.reason,
        closedUntil: body.until ? new Date(body.until) : null,
      },
    });
    return { ok: true, data: branch };
  });

  // === Aksiyalar ===
  app.post('/promotions', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canManagePromotions) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const parse = promotionSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() } });
    const promo = await prisma.promotion.create({
      data: {
        branchId: a.branchId,
        ...parse.data,
        validFrom: new Date(parse.data.validFrom),
        validUntil: new Date(parse.data.validUntil),
      },
    });
    return { ok: true, data: promo };
  });

  // === Daromad ko'rish ===
  app.get('/income', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canViewIncome) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const balance = await prisma.balance.findUnique({ where: { branchId: a.branchId } });
    return { ok: true, data: balance };
  });

  // === Shikoyatlar ===
  app.get('/complaints', async (req, reply) => {
    const userCtx = (req as any).user;
    const a = await getAssistant(userCtx.userId);
    if (!a || !a.canViewComplaints) return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q' } });
    const complaints = await prisma.complaint.findMany({
      where: { branchId: a.branchId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { ok: true, data: complaints };
  });
}
