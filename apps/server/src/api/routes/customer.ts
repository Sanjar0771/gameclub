import type { FastifyInstance } from 'fastify';
import { prisma, BookingStatus, PaymentStatus } from '@gameclub/db';
import {
  bookingCreateSchema,
  ratingSchema,
  complaintSchema,
  calculateBookingPrice,
  calculateCommission,
  generateBookingCode,
  SLOT_MINUTES,
  CANCEL_HOURS_BEFORE,
  BOOKING_ADVANCE_DAYS,
} from '@gameclub/shared';
import { requireRole } from '../middleware.js';
import { audit } from '../../lib/audit.js';

export async function customerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('CUSTOMER', 'PARTNER', 'ASSISTANT', 'PRE_ADMIN', 'SUPER_ADMIN'));

  // === Branches ro'yxati (filterlar bilan) ===
  app.get('/branches', async (req) => {
    const q = req.query as {
      region?: string;
      city?: string;
      lat?: string;
      lng?: string;
      hasPromo?: string;
      minRating?: string;
      computerType?: string;
      search?: string;
      sort?: 'distance' | 'rating' | 'price';
    };

    const where: any = { status: 'ACTIVE', partner: { status: 'APPROVED' } };
    if (q.region) where.region = q.region;
    if (q.city) where.city = q.city;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { address: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const branches = await prisma.branch.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        computerTypes: true,
        computers: { select: { id: true, status: true, typeId: true } },
        promotions: {
          where: { isActive: true, validFrom: { lte: new Date() }, validUntil: { gte: new Date() } },
        },
        ratings: { select: { stars: true } },
      },
      take: 50,
    });

    const userLat = q.lat ? Number(q.lat) : null;
    const userLng = q.lng ? Number(q.lng) : null;

    let data = branches.map((b) => {
      const avgRating =
        b.ratings.length > 0 ? b.ratings.reduce((a, r) => a + r.stars, 0) / b.ratings.length : 0;
      const availableComputers = b.computers.filter((c) => c.status === 'AVAILABLE').length;
      const minPrice = b.computerTypes.reduce(
        (min, t) => Math.min(min, t.dayPrice),
        Number.MAX_SAFE_INTEGER,
      );
      let distance: number | null = null;
      if (userLat !== null && userLng !== null && b.latitude && b.longitude) {
        distance = haversineKm(userLat, userLng, b.latitude, b.longitude);
      }
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        region: b.region,
        city: b.city,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        openTime: b.openTime,
        closeTime: b.closeTime,
        worksAroundClock: b.worksAroundClock,
        image: b.images[0]?.url ?? null,
        computerTypes: b.computerTypes.map((t) => ({
          id: t.id,
          name: t.name,
          dayPrice: t.dayPrice,
          nightPrice: t.nightPrice,
        })),
        availableComputers,
        totalComputers: b.computers.length,
        minPrice: minPrice === Number.MAX_SAFE_INTEGER ? null : minPrice,
        avgRating: Math.round(avgRating * 10) / 10,
        ratingsCount: b.ratings.length,
        hasPromo: b.promotions.length > 0,
        distance,
      };
    });

    // Filterlar
    if (q.hasPromo === 'true') data = data.filter((d) => d.hasPromo);
    if (q.minRating) data = data.filter((d) => d.avgRating >= Number(q.minRating));
    if (q.computerType) {
      data = data.filter((d) => d.computerTypes.some((t) => t.name === q.computerType));
    }

    // Saralash
    if (q.sort === 'distance' && userLat !== null) {
      data.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else if (q.sort === 'rating') {
      data.sort((a, b) => b.avgRating - a.avgRating);
    } else if (q.sort === 'price') {
      data.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
    }

    return { ok: true, data };
  });

  // === Bitta gameclub batafsil ===
  app.get('/branches/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const branch = await prisma.branch.findFirst({
      where: { id, status: 'ACTIVE', partner: { status: 'APPROVED' } },
      include: {
        images: { orderBy: { order: 'asc' } },
        computerTypes: true,
        computers: { include: { type: true } },
        promotions: {
          where: { isActive: true, validFrom: { lte: new Date() }, validUntil: { gte: new Date() } },
        },
        ratings: {
          include: { customer: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!branch) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    const avg = branch.ratings.length
      ? branch.ratings.reduce((a, r) => a + r.stars, 0) / branch.ratings.length
      : 0;
    return {
      ok: true,
      data: {
        ...branch,
        avgRating: Math.round(avg * 10) / 10,
        ratingsCount: branch.ratings.length,
        cardNumber: undefined, // mijoz uchun yashirin
      },
    };
  });

  // === Mavjud slotlar (bron qilish uchun) ===
  app.get('/branches/:id/availability', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { date?: string; computerId?: string; duration?: string };

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: { computers: { include: { type: true } } },
    });
    if (!branch || branch.status !== 'ACTIVE') {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }

    const date = q.date ? new Date(q.date) : new Date();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Shu kun bronlarini olish
    const bookings = await prisma.booking.findMany({
      where: {
        branchId: id,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.PAYMENT_REVIEW, BookingStatus.PENDING_PAYMENT] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      select: { computerId: true, startAt: true, endAt: true },
    });

    // Har bir PC uchun mavjud slotlar
    const computerAvailability = branch.computers
      .filter((c) => c.status !== 'BROKEN')
      .map((computer) => {
        const occupied = bookings
          .filter((b) => b.computerId === computer.id)
          .map((b) => ({ start: b.startAt, end: b.endAt }));
        return {
          computerId: computer.id,
          computerName: computer.name,
          typeId: computer.typeId,
          typeName: computer.type.name,
          status: computer.status,
          occupied,
        };
      });

    return { ok: true, data: { date: dayStart.toISOString(), computers: computerAvailability } };
  });

  // === Bron yaratish ===
  app.post('/bookings', async (req, reply) => {
    const userCtx = (req as any).user;
    const parse = bookingCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }

    const { computerId, startAt, durationMinutes, isNightPackage, promotionId } = parse.data;
    const startDate = new Date(startAt);

    // Vaqt 30 daqiqalik slotga to'g'ri keladimi
    if (startDate.getMinutes() % SLOT_MINUTES !== 0) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Vaqt 30 daqiqali slotga to\'g\'ri kelishi kerak' },
      });
    }

    const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

    // Bron oldindan ham, juda uzoq kelajakka ham bo'lmasligi kerak
    const now = new Date();
    const maxFuture = new Date(now.getTime() + BOOKING_ADVANCE_DAYS * 24 * 60 * 60 * 1000);
    if (startDate < now) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'O\'tgan vaqtga bron qilib bo\'lmaydi' },
      });
    }
    if (startDate > maxFuture) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: `Faqat ${BOOKING_ADVANCE_DAYS} kun oldin bron qilish mumkin` },
      });
    }

    // Computer va branch tekshiruvi
    const computer = await prisma.computer.findUnique({
      where: { id: computerId },
      include: { type: true, branch: true },
    });
    if (!computer || computer.status === 'BROKEN') {
      return reply.code(400).send({
        ok: false,
        error: { code: 'COMPUTER_UNAVAILABLE', message: 'Kompyuter mavjud emas' },
      });
    }
    if (computer.branch.status !== 'ACTIVE') {
      return reply.code(400).send({
        ok: false,
        error: { code: 'BRANCH_CLOSED', message: 'Filial yopiq' },
      });
    }

    // Slot bandligini tekshirish (transaction ichida)
    const result = await prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          computerId,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.PAYMENT_REVIEW, BookingStatus.PENDING_PAYMENT] },
          startAt: { lt: endDate },
          endAt: { gt: startDate },
        },
      });
      if (conflict) {
        return { error: 'BOOKING_SLOT_TAKEN' as const };
      }

      // Promotion tekshiruvi
      let discountPct = 0;
      let promo = null;
      if (promotionId) {
        promo = await tx.promotion.findFirst({
          where: {
            id: promotionId,
            branchId: computer.branchId,
            isActive: true,
            validFrom: { lte: now },
            validUntil: { gte: now },
          },
        });
        if (promo) {
          // First booking check
          if (promo.firstBookingOnly) {
            const prevBookings = await tx.booking.count({
              where: { customerId: userCtx.userId, status: { in: [BookingStatus.COMPLETED, BookingStatus.ACTIVE] } },
            });
            if (prevBookings > 0) promo = null;
          }
          if (promo?.maxUses && promo.usedCount >= promo.maxUses) promo = null;
        }
        discountPct = promo?.discountPct ?? 0;
      }

      // Narx hisoblash
      const { basePrice, discountAmount, total } = calculateBookingPrice({
        startAt: startDate,
        durationMinutes,
        dayPrice: computer.type.dayPrice,
        nightPrice: computer.type.nightPrice,
        dayStartTime: computer.type.dayStartTime,
        dayEndTime: computer.type.dayEndTime,
        isNightPackage: isNightPackage ?? false,
        nightPackagePrice: computer.type.nightPackagePrice ?? undefined,
        discountPct,
      });

      if (promo && discountAmount > 0 && promo.minAmount && basePrice < promo.minAmount) {
        return { error: 'PROMO_MIN_AMOUNT' as const };
      }

      const commissionPct = Number(computer.branch.commissionPct);
      const { commissionAmount, partnerAmount } = calculateCommission(total, commissionPct);

      const booking = await tx.booking.create({
        data: {
          code: generateBookingCode(),
          customerId: userCtx.userId,
          branchId: computer.branchId,
          computerId,
          promotionId: promo?.id,
          startAt: startDate,
          endAt: endDate,
          durationMinutes,
          isNightPackage: isNightPackage ?? false,
          basePrice,
          discountAmount,
          totalAmount: total,
          commissionPct: commissionPct as any,
          commissionAmount,
          partnerAmount,
          status: BookingStatus.PENDING_PAYMENT,
          payment: {
            create: {
              amount: total,
              cardNumber: computer.branch.cardNumber,
              status: PaymentStatus.AWAITING_RECEIPT,
            },
          },
        },
        include: { payment: true, branch: true, computer: true },
      });

      if (promo) {
        await tx.promotion.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      return { ok: true as const, booking };
    });

    if ('error' in result) {
      const code = result.error === 'BOOKING_SLOT_TAKEN' ? 409 : 400;
      return reply.code(code).send({
        ok: false,
        error: { code: result.error, message: result.error },
      });
    }

    await audit({
      actorId: userCtx.userId,
      actorRole: 'CUSTOMER',
      action: 'BOOKING_CREATED',
      targetType: 'Booking',
      targetId: result.booking.id,
      metadata: { total: result.booking.totalAmount },
    });

    return { ok: true, data: result.booking };
  });

  // === Mijozning bronlari ===
  app.get('/bookings', async (req) => {
    const userCtx = (req as any).user;
    const bookings = await prisma.booking.findMany({
      where: { customerId: userCtx.userId },
      include: {
        branch: { select: { name: true, address: true, phone: true } },
        computer: { include: { type: true } },
        payment: true,
        rating: true,
      },
      orderBy: { startAt: 'desc' },
      take: 50,
    });
    return { ok: true, data: bookings };
  });

  // === Bron bekor qilish ===
  app.post('/bookings/:id/cancel', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.customerId !== userCtx.userId) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    if (![BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_REVIEW, BookingStatus.CONFIRMED].includes(booking.status as any)) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Bu bronni bekor qilib bo\'lmaydi' },
      });
    }
    const hoursLeft = (booking.startAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (booking.status === BookingStatus.CONFIRMED && hoursLeft < CANCEL_HOURS_BEFORE) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'VALIDATION',
          message: `Bron ${CANCEL_HOURS_BEFORE} soat oldin bekor qilinishi kerak edi`,
        },
      });
    }

    await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED_BY_USER,
        cancelledAt: new Date(),
        cancelReason: 'Mijoz bekor qildi',
      },
    });

    await audit({
      actorId: userCtx.userId,
      actorRole: 'CUSTOMER',
      action: 'BOOKING_CANCELLED',
      targetType: 'Booking',
      targetId: id,
    });

    return { ok: true, data: { cancelled: true } };
  });

  // === Bron uzaytirish ===
  app.post('/bookings/:id/extend', async (req, reply) => {
    const userCtx = (req as any).user;
    const { id } = req.params as { id: string };
    const body = req.body as { extraMinutes?: number };
    if (!body?.extraMinutes || body.extraMinutes < SLOT_MINUTES) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'extraMinutes 30 dan kam bo\'lmasligi kerak' },
      });
    }
    const orig = await prisma.booking.findUnique({
      where: { id },
      include: { computer: { include: { type: true, branch: true } } },
    });
    if (!orig || orig.customerId !== userCtx.userId) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    if (orig.status !== BookingStatus.ACTIVE) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Faqat faol bronni uzaytirish mumkin' },
      });
    }

    const newStart = orig.endAt;
    const newEnd = new Date(newStart.getTime() + body.extraMinutes * 60_000);

    // Konflikt tekshiruvi
    const conflict = await prisma.booking.findFirst({
      where: {
        computerId: orig.computerId,
        id: { not: orig.id },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.PAYMENT_REVIEW, BookingStatus.PENDING_PAYMENT] },
        startAt: { lt: newEnd },
        endAt: { gt: newStart },
      },
    });
    if (conflict) {
      return reply.code(409).send({
        ok: false,
        error: { code: 'BOOKING_SLOT_TAKEN', message: 'Bu vaqt band' },
      });
    }

    const { basePrice, total } = calculateBookingPrice({
      startAt: newStart,
      durationMinutes: body.extraMinutes,
      dayPrice: orig.computer.type.dayPrice,
      nightPrice: orig.computer.type.nightPrice,
      dayStartTime: orig.computer.type.dayStartTime,
      dayEndTime: orig.computer.type.dayEndTime,
    });
    const commissionPct = Number(orig.commissionPct);
    const { commissionAmount, partnerAmount } = calculateCommission(total, commissionPct);

    const extension = await prisma.booking.create({
      data: {
        code: generateBookingCode(),
        customerId: orig.customerId,
        branchId: orig.branchId,
        computerId: orig.computerId,
        startAt: newStart,
        endAt: newEnd,
        durationMinutes: body.extraMinutes,
        basePrice,
        discountAmount: 0,
        totalAmount: total,
        commissionPct: commissionPct as any,
        commissionAmount,
        partnerAmount,
        status: BookingStatus.PENDING_PAYMENT,
        extendedFromId: orig.id,
        payment: {
          create: {
            amount: total,
            cardNumber: orig.computer.branch.cardNumber,
            status: PaymentStatus.AWAITING_RECEIPT,
          },
        },
      },
    });

    return { ok: true, data: extension };
  });

  // === Baholash ===
  app.post('/ratings', async (req, reply) => {
    const userCtx = (req as any).user;
    const parse = ratingSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    const booking = await prisma.booking.findUnique({ where: { id: parse.data.bookingId } });
    if (!booking || booking.customerId !== userCtx.userId) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
    if (booking.status !== BookingStatus.COMPLETED && booking.status !== BookingStatus.NO_SHOW) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Bron hali tugamagan' },
      });
    }
    const rating = await prisma.rating.upsert({
      where: { bookingId: booking.id },
      update: { stars: parse.data.stars, comment: parse.data.comment },
      create: {
        bookingId: booking.id,
        customerId: userCtx.userId,
        branchId: booking.branchId,
        stars: parse.data.stars,
        comment: parse.data.comment,
      },
    });
    return { ok: true, data: rating };
  });

  // === Shikoyat ===
  app.post('/complaints', async (req, reply) => {
    const userCtx = (req as any).user;
    const parse = complaintSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Validation', details: parse.error.flatten() },
      });
    }
    const complaint = await prisma.complaint.create({
      data: {
        customerId: userCtx.userId,
        branchId: parse.data.branchId,
        bookingId: parse.data.bookingId,
        subject: parse.data.subject,
        message: parse.data.message,
      },
    });
    return { ok: true, data: complaint };
  });

  // === Sevimlilar ===
  app.get('/favorites', async (req) => {
    const userCtx = (req as any).user;
    const favs = await prisma.favorite.findMany({
      where: { userId: userCtx.userId },
      include: { branch: { include: { images: { take: 1 } } } },
    });
    return { ok: true, data: favs };
  });

  app.post('/favorites/:branchId', async (req) => {
    const userCtx = (req as any).user;
    const { branchId } = req.params as { branchId: string };
    const fav = await prisma.favorite.upsert({
      where: { userId_branchId: { userId: userCtx.userId, branchId } },
      update: {},
      create: { userId: userCtx.userId, branchId },
    });
    return { ok: true, data: fav };
  });

  app.delete('/favorites/:branchId', async (req) => {
    const userCtx = (req as any).user;
    const { branchId } = req.params as { branchId: string };
    await prisma.favorite.deleteMany({
      where: { userId: userCtx.userId, branchId },
    });
    return { ok: true, data: { removed: true } };
  });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
