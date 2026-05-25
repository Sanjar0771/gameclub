import { prisma, NotificationType, type User } from '@gameclub/db';
import { bot } from '../bot/index.js';
import { log } from '../lib/logger.js';
import { generateQrPayload, generateQrImage } from '../lib/qr.js';
import { InputFile } from 'grammy';

export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  titleUz: string;
  titleRu: string;
  bodyUz: string;
  bodyRu: string;
  data?: Record<string, unknown>;
  sendViaBot?: boolean;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return;

  const lang = user.language;
  const title = lang === 'UZ' ? params.titleUz : params.titleRu;
  const body = lang === 'UZ' ? params.bodyUz : params.bodyRu;

  // Bazaga yozish
  const notif = await prisma.notification.create({
    data: {
      userId: user.id,
      type: params.type,
      title,
      body,
      data: params.data ? (params.data as any) : undefined,
      sentViaBot: false,
    },
  });

  // Bot orqali yuborish
  if (params.sendViaBot !== false) {
    try {
      await bot.api.sendMessage(user.telegramId.toString(), `${title}\n\n${body}`, {
        parse_mode: 'HTML',
      });
      await prisma.notification.update({
        where: { id: notif.id },
        data: { sentViaBot: true },
      });
    } catch (e) {
      log.warn(`Bot xabari yuborilmadi: ${user.telegramId}`, e);
    }
  }
}

/**
 * Mijozga bron tasdiqlandi xabari + QR kod rasmi
 */
export async function sendBookingConfirmedWithQr(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, branch: true, computer: true },
  });
  if (!booking) return;

  const payload = generateQrPayload(booking.id);
  await prisma.booking.update({
    where: { id: booking.id },
    data: { qrCode: payload },
  });

  const qrImage = await generateQrImage(payload);
  const lang = booking.customer.language;

  const startStr = booking.startAt.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
  const endStr = booking.endAt.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });

  const caption =
    lang === 'UZ'
      ? `✅ <b>Bron tasdiqlandi!</b>\n\n📍 ${booking.branch.name}\n📌 ${booking.branch.address}\n🖥 ${booking.computer.name}\n⏰ ${startStr} — ${endStr}\n💰 ${booking.totalAmount} so'm\n\n🔢 Bron kodi: <code>${booking.code}</code>\n\nGameclubga borib QR-kodni ko'rsating 👇`
      : `✅ <b>Бронь подтверждена!</b>\n\n📍 ${booking.branch.name}\n📌 ${booking.branch.address}\n🖥 ${booking.computer.name}\n⏰ ${startStr} — ${endStr}\n💰 ${booking.totalAmount} сум\n\n🔢 Код брони: <code>${booking.code}</code>\n\nПокажите QR-код в геймклубе 👇`;

  try {
    await bot.api.sendPhoto(
      Number(booking.customer.telegramId),
      new InputFile(qrImage, `qr-${booking.code}.png`),
      { caption, parse_mode: 'HTML' },
    );

    await prisma.notification.create({
      data: {
        userId: booking.customer.id,
        type: NotificationType.BOOKING_CONFIRMED,
        title: lang === 'UZ' ? 'Bron tasdiqlandi' : 'Бронь подтверждена',
        body: caption,
        sentViaBot: true,
        data: { bookingId: booking.id } as any,
      },
    });
  } catch (e) {
    log.error('QR yuborilmadi', e);
  }
}

/**
 * Bron eslatmasi (30 daqiqa qoldi)
 */
export async function sendBookingReminder(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, branch: true, computer: true },
  });
  if (!booking || booking.reminderSentAt) return;

  await notifyUser({
    userId: booking.customer.id,
    type: NotificationType.BOOKING_REMINDER,
    titleUz: '⏰ Eslatma',
    titleRu: '⏰ Напоминание',
    bodyUz: `30 daqiqadan keyin bronyingiz boshlanadi:\n📍 ${booking.branch.name}\n🖥 ${booking.computer.name}`,
    bodyRu: `Через 30 минут начнётся ваша бронь:\n📍 ${booking.branch.name}\n🖥 ${booking.computer.name}`,
    data: { bookingId: booking.id },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { reminderSentAt: new Date() },
  });
}

/**
 * Barcha super-adminlarga xabar yuborish
 */
export async function notifySuperAdmin(params: {
  titleUz: string;
  titleRu: string;
  bodyUz: string;
  bodyRu: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });

  for (const admin of admins) {
    await notifyUser({
      userId: admin.id,
      type: NotificationType.SYSTEM,
      titleUz: params.titleUz,
      titleRu: params.titleRu,
      bodyUz: params.bodyUz,
      bodyRu: params.bodyRu,
    });
  }
}
