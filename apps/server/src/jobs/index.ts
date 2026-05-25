import cron from 'node-cron';
import { prisma, BookingStatus } from '@gameclub/db';
import { log } from '../lib/logger.js';
import { sendBookingReminder, notifyUser } from '../services/notifications.js';
import { NO_SHOW_AFTER_MINUTES, REMINDER_MINUTES_BEFORE } from '@gameclub/shared';

/**
 * Har minutda ishlaydi — eslatmalar, no-show, completed
 */
export function startCronJobs() {
  // Har minutda
  cron.schedule('* * * * *', async () => {
    try {
      await processReminders();
      await processNoShows();
      await processCompleted();
      await processExpiredPayments();
      await processBranchAutoOpen();
    } catch (e) {
      log.error('Cron error', e);
    }
  });

  // Har soatda — rate request (bron tugagandan keyin 1 soat o'tgach)
  cron.schedule('0 * * * *', async () => {
    try {
      await processRatingRequests();
    } catch (e) {
      log.error('Rating cron error', e);
    }
  });

  log.info('⏰ Cron jobs ishga tushdi');
}

async function processReminders() {
  const now = Date.now();
  const reminderTime = new Date(now + REMINDER_MINUTES_BEFORE * 60_000);
  const windowStart = new Date(reminderTime.getTime() - 60_000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      reminderSentAt: null,
      startAt: { gte: windowStart, lte: reminderTime },
    },
    select: { id: true },
  });

  for (const b of bookings) {
    await sendBookingReminder(b.id);
  }
  if (bookings.length > 0) {
    log.info(`📨 ${bookings.length} ta eslatma yuborildi`);
  }
}

async function processNoShows() {
  const cutoff = new Date(Date.now() - NO_SHOW_AFTER_MINUTES * 60_000);
  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startAt: { lt: cutoff },
      qrConfirmedAt: null,
    },
    select: { id: true, branchId: true, partnerAmount: true },
  });

  for (const b of candidates) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: b.id },
        data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
      });
      await tx.balance.update({
        where: { branchId: b.branchId },
        data: {
          amount: { increment: b.partnerAmount },
          totalEarned: { increment: b.partnerAmount },
        },
      });
    });
  }
  if (candidates.length > 0) {
    log.info(`🚫 ${candidates.length} ta no-show belgilandi`);
  }
}

async function processCompleted() {
  // ACTIVE statusdagi bronlar tugasa → COMPLETED
  const now = new Date();
  const activeOnes = await prisma.booking.findMany({
    where: {
      status: BookingStatus.ACTIVE,
      endAt: { lt: now },
    },
    select: { id: true },
  });
  for (const b of activeOnes) {
    await prisma.booking.update({
      where: { id: b.id },
      data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
    });
  }
  if (activeOnes.length > 0) {
    log.info(`✅ ${activeOnes.length} ta bron tugatildi`);
  }
}

async function processExpiredPayments() {
  // PENDING_PAYMENT bo'lgan, lekin bron vaqti boshlanib bo'lgan bronlar — EXPIRED
  const now = new Date();
  const expired = await prisma.booking.findMany({
    where: {
      status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_REVIEW] },
      startAt: { lt: now },
    },
    select: { id: true },
  });
  for (const b of expired) {
    await prisma.booking.update({
      where: { id: b.id },
      data: { status: BookingStatus.EXPIRED },
    });
  }
}

async function processBranchAutoOpen() {
  // closedUntil vaqti o'tgan filiallarni avtomatik ochish
  const now = new Date();
  await prisma.branch.updateMany({
    where: { status: 'CLOSED', closedUntil: { lt: now } },
    data: { status: 'ACTIVE', closedReason: null, closedUntil: null },
  });
}

async function processRatingRequests() {
  // Bron tugagandan 1 soat o'tgan va hali baholanmagan bronlar
  const cutoff = new Date(Date.now() - 60 * 60_000);
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: [BookingStatus.COMPLETED, BookingStatus.NO_SHOW] },
      completedAt: { lt: cutoff },
      rating: { is: null },
      reminderSentAt: { not: null }, // faqat eslatma yuborilganlarga
    },
    include: { branch: { select: { name: true } }, customer: true },
    take: 20,
  });

  for (const b of candidates) {
    // Bir martadan ko'p so'ralmasin uchun reminderSentAt'ni ishlatamiz
    // (yoki alohida ustun qo'shish mumkin)
    await notifyUser({
      userId: b.customer.id,
      type: 'BOOKING_REMINDER',
      titleUz: '⭐ Bahoyingizni qoldiring',
      titleRu: '⭐ Оставьте оценку',
      bodyUz: `${b.branch.name} qanday edi? WebApp orqali baho qoldiring.`,
      bodyRu: `Как вам ${b.branch.name}? Оставьте оценку через WebApp.`,
    });
  }
}
