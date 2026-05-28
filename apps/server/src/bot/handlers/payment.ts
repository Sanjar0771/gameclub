import type { Bot } from 'grammy';
import { prisma, BookingStatus, PaymentStatus } from '@gameclub/db';
import type { BotContext } from '../index.js';
import { getDbUser, getLang } from './_utils.js';
import { log } from '../../lib/logger.js';
import { uploadTelegramFileToCloudinary, getTelegramFileUrl } from '../../lib/cloudinary.js';
import { notifySuperAdmin } from '../../services/notifications.js';
import { config } from '../../config.js';

export function registerPaymentHandlers(bot: Bot<BotContext>) {
  bot.on('message:photo', async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    const booking = await prisma.booking.findFirst({
      where: {
        customerId: user.id,
        status: BookingStatus.PENDING_PAYMENT,
      },
      orderBy: { createdAt: 'desc' },
      include: { payment: true, branch: true },
    });

    if (!booking) {
      await ctx.reply(
        lang === 'UZ'
          ? '⚠️ To\'lov kutayotgan bronyingiz topilmadi. Iltimos avval bron qiling.'
          : '⚠️ Не найдена бронь, ожидающая оплаты. Сначала создайте бронь.',
      );
      return;
    }

    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];
    if (!bestPhoto) return;

    const statusMsg = await ctx.reply(
      lang === 'UZ'
        ? '⏳ Chekingiz qabul qilindi, tekshirilmoqda...'
        : '⏳ Чек принят, проверяется...',
    );

    let receiptUrl: string | null = null;
    try {
      receiptUrl = await uploadTelegramFileToCloudinary(bestPhoto.file_id);
    } catch (e) {
      log.error('Receipt upload failed (Cloudinary), trying direct Telegram URL', e);
    }

    // Cloudinary ishlamasa — Telegram HTTPS URL ishlatamiz (brauzerda ochiladi)
    if (!receiptUrl) {
      receiptUrl = await getTelegramFileUrl(bestPhoto.file_id);
    }
    const finalUrl = receiptUrl ?? `tg://file/${bestPhoto.file_id}`;

    await prisma.payment.update({
      where: { bookingId: booking.id },
      data: {
        status: PaymentStatus.RECEIPT_UPLOADED,
        receiptImage: finalUrl,
        uploadedAt: new Date(),
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.PAYMENT_REVIEW },
    });

    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      lang === 'UZ'
        ? `✅ Chek qabul qilindi!\n\nBron: ${booking.code}\nFilial: ${booking.branch.name}\nSumma: ${booking.totalAmount.toLocaleString('ru-RU')} so'm\n\n📋 Administrator tekshirib bo'lishi bilan QR-kod yuboriladi.\n\n⏱️ Odatda 5-15 daqiqa vaqt oladi.`
        : `✅ Чек принят!\n\nБронь: ${booking.code}\nФилиал: ${booking.branch.name}\nСумма: ${booking.totalAmount.toLocaleString('ru-RU')} сум\n\n📋 После проверки администратором будет отправлен QR-код.\n\n⏱️ Обычно занимает 5-15 минут.`,
    );

    // Super adminga chek rasmini yuborish (matn emas, rasm bilan)
    const card = config.PLATFORM_CARD_NUMBER ?? '';
    const cardFormatted = card.replace(/(\d{4})/g, '$1 ').trim();
    const admins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
    });
    for (const admin of admins) {
      try {
        const aLang = admin.language;
        const caption = aLang === 'UZ'
          ? `💳 <b>Yangi to'lov chek</b>\n\n📍 ${booking.branch.name}\n👤 Mijoz: ${user.firstName ?? '—'} (TG: ${user.telegramId})\n💰 Summa: ${booking.totalAmount.toLocaleString('ru-RU')} so'm\n💳 Karta: <code>${cardFormatted}</code>\n🔢 Bron: ${booking.code}\n\n👆 Chek rasmi yuqorida. WebApp'da tasdiqlang.`
          : `💳 <b>Новый чек оплаты</b>\n\n📍 ${booking.branch.name}\n👤 Клиент: ${user.firstName ?? '—'} (TG: ${user.telegramId})\n💰 Сумма: ${booking.totalAmount.toLocaleString('ru-RU')} сум\n💳 Карта: <code>${cardFormatted}</code>\n🔢 Бронь: ${booking.code}\n\n👆 Чек выше. Подтвердите в WebApp.`;

        if (finalUrl && !finalUrl.startsWith('tg://')) {
          await ctx.api.sendPhoto(admin.telegramId.toString(), finalUrl, {
            caption,
            parse_mode: 'HTML',
          });
        } else {
          // Rasm URL ishlamasa — matn yuboramiz
          await ctx.api.sendMessage(admin.telegramId.toString(), caption, { parse_mode: 'HTML' });
        }
      } catch (e) {
        log.warn(`Admin notify failed: ${admin.telegramId}`, e);
      }
    }

    log.info(`💳 Receipt uploaded: booking ${booking.id}`);
  });
}
