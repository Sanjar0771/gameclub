import { Bot, GrammyError, HttpError, session, type Context, type SessionFlavor } from 'grammy';
import { prisma, Role, Language } from '@gameclub/db';
import { config } from '../config.js';
import { log } from '../lib/logger.js';
import { registerStartHandler } from './handlers/start.js';
import { registerLanguageHandler } from './handlers/language.js';
import { registerPartnerHandlers } from './handlers/partner.js';
import { registerCustomerHandlers } from './handlers/customer.js';
import { registerHelpHandler } from './handlers/help.js';
import { registerPaymentHandlers } from './handlers/payment.js';
import { registerAdminHandlers } from './handlers/admin.js';

export interface SessionData {
  step?: string;
  // Hamkor ro'yxati uchun
  partnerReg?: { fullName?: string; phone?: string };
  // Shikoyat uchun
  complaint?: { subject?: string };
  // To'lov uchun
  awaitingPaymentReceipt?: string; // bookingId
}

export type BotContext = Context & SessionFlavor<SessionData>;

export const bot = new Bot<BotContext>(config.BOT_TOKEN);

// Session middleware (xotirada — production'da Redis ham mumkin)
bot.use(
  session({
    initial: (): SessionData => ({}),
  }),
);

// Foydalanuvchini ma'lumotlar bazasida yaratish/yangilash
bot.use(async (ctx, next) => {
  const from = ctx.from;
  if (!from || from.is_bot) return next();

  const tgId = BigInt(from.id);
  const user = await prisma.user.upsert({
    where: { telegramId: tgId },
    update: {
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      lastSeenAt: new Date(),
    },
    create: {
      telegramId: tgId,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      language: from.language_code === 'ru' ? Language.RU : Language.UZ,
      role: Role.CUSTOMER,
      lastSeenAt: new Date(),
    },
  });

  // Super admin maxsus tekshiruvi
  if (user.role !== Role.SUPER_ADMIN && tgId === config.SUPER_ADMIN_TELEGRAM_ID) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.SUPER_ADMIN },
    });
    user.role = Role.SUPER_ADMIN;
  }

  // ctx ga foydalanuvchini biriktirish
  (ctx as any).dbUser = user;

  return next();
});

// Handlerlarni ulash
registerLanguageHandler(bot);
registerStartHandler(bot);
registerHelpHandler(bot);
registerCustomerHandlers(bot);
registerPartnerHandlers(bot);
registerPaymentHandlers(bot);
registerAdminHandlers(bot);

// Global error handler
bot.catch((err) => {
  const ctx = err.ctx;
  log.error(`Bot xato (${ctx.update.update_id})`, err.error);

  const e = err.error;
  if (e instanceof GrammyError) {
    log.error('Telegram API xatosi', e.description);
  } else if (e instanceof HttpError) {
    log.error('Telegramga ulanish xatosi', e);
  }
});

export async function startBot() {
  log.info('🤖 Bot ishga tushmoqda...');

  // Webhook o'rniga long polling (Railway uchun oson)
  await bot.start({
    drop_pending_updates: true,
    onStart: (info) => {
      log.info(`✅ Bot @${info.username} ishga tushdi`);
    },
  });
}

export async function stopBot() {
  await bot.stop();
  log.info('🛑 Bot to\'xtatildi');
}
