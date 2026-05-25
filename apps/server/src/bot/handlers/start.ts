import type { Bot } from 'grammy';
import { prisma } from '@gameclub/db';
import { t } from '@gameclub/i18n';
import type { BotContext } from '../index.js';
import {
  getDbUser,
  getLang,
  langKeyboard,
  customerMainMenu,
  partnerMainMenu,
  adminMainMenu,
  assistantMainMenu,
  webAppButton,
} from './_utils.js';
import { config } from '../../config.js';

export function registerStartHandler(bot: Bot<BotContext>) {
  bot.command('start', async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;

    // Birinchi marta kirgan bo'lsa — til so'rash (createdAt 10 soniya ichida = yangi user)
    const isFirstTime = Date.now() - user.createdAt.getTime() < 10_000;
    if (isFirstTime && user.role === 'CUSTOMER') {
      await ctx.reply('🌐 Tilni tanlang / Выберите язык:', {
        reply_markup: langKeyboard(),
      });
      return;
    }

    const lang = getLang(user);
    await routeByRole(ctx, user, lang);
  });
}

export async function routeByRole(
  ctx: BotContext,
  user: { id: string; role: string; language: string },
  lang: 'UZ' | 'RU',
) {
  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'PRE_ADMIN': {
      const text =
        lang === 'UZ'
          ? `🛠 ${user.role === 'SUPER_ADMIN' ? 'Bosh administrator' : 'Administrator'} paneli\n\nWebApp orqali boshqaring 👇`
          : `🛠 Панель ${user.role === 'SUPER_ADMIN' ? 'главного администратора' : 'администратора'}\n\nУправляйте через WebApp 👇`;
      await ctx.reply(text, {
        reply_markup: webAppButton(lang === 'UZ' ? '🛠 WebApp ochish' : '🛠 Открыть WebApp', '/admin'),
      });
      await ctx.reply(t('common.home', lang), {
        reply_markup: adminMainMenu(lang),
      });
      break;
    }
    case 'PARTNER': {
      const partner = await prisma.partner.findUnique({ where: { userId: user.id } });
      if (!partner) {
        // Hali ariza topshirmagan
        await ctx.reply(
          lang === 'UZ'
            ? '👋 Salom! Siz hamkor sifatida ro\'yxatdan o\'tmoqchimisiz?\n\n/register tugmasini bosing.'
            : '👋 Здравствуйте! Хотите зарегистрироваться как партнёр?\n\nНажмите /register.',
        );
        return;
      }
      if (partner.status === 'PENDING') {
        await ctx.reply(
          lang === 'UZ'
            ? '⏳ Sizning arizangiz ko\'rib chiqilmoqda. Iltimos, kuting.'
            : '⏳ Ваша заявка рассматривается. Пожалуйста, подождите.',
        );
        return;
      }
      if (partner.status === 'REJECTED') {
        await ctx.reply(
          lang === 'UZ'
            ? `❌ Sizning arizangiz rad etildi.\nSabab: ${partner.rejectReason ?? 'ko\'rsatilmagan'}\n\nQayta ariza yuborish: /register`
            : `❌ Ваша заявка отклонена.\nПричина: ${partner.rejectReason ?? 'не указана'}\n\nПовторная заявка: /register`,
        );
        return;
      }
      if (partner.status === 'BANNED') {
        await ctx.reply(
          lang === 'UZ' ? '🚫 Sizning akkauntingiz bloklangan.' : '🚫 Ваш аккаунт заблокирован.',
        );
        return;
      }
      // APPROVED
      const text =
        lang === 'UZ'
          ? '👨‍💼 Hamkor paneli\n\nWebApp orqali filiallaringizni boshqaring 👇'
          : '👨‍💼 Панель партнёра\n\nУправляйте филиалами через WebApp 👇';
      await ctx.reply(text, {
        reply_markup: webAppButton(lang === 'UZ' ? '🏢 WebApp ochish' : '🏢 Открыть WebApp', '/partner'),
      });
      await ctx.reply(t('common.home', lang), {
        reply_markup: partnerMainMenu(lang),
      });
      break;
    }
    case 'ASSISTANT': {
      const text =
        lang === 'UZ'
          ? '🧑‍💻 Yordamchi paneli\n\nWebApp orqali bronlarni boshqaring 👇'
          : '🧑‍💻 Панель помощника\n\nУправляйте бронями через WebApp 👇';
      await ctx.reply(text, {
        reply_markup: webAppButton(lang === 'UZ' ? '🎮 WebApp ochish' : '🎮 Открыть WebApp', '/assistant'),
      });
      await ctx.reply(t('common.home', lang), {
        reply_markup: assistantMainMenu(lang),
      });
      break;
    }
    case 'CUSTOMER':
    default: {
      const text =
        lang === 'UZ'
          ? `👋 Assalomu alaykum!\n\n🎮 GameClub'ga xush kelibsiz!\n\nKompyuter bron qilish uchun WebApp'ni oching:`
          : `👋 Здравствуйте!\n\n🎮 Добро пожаловать в GameClub!\n\nОткройте WebApp для бронирования:`;
      await ctx.reply(text, {
        reply_markup: webAppButton(
          lang === 'UZ' ? '🎮 Gameclub topish' : '🎮 Найти геймклуб',
          '/customer',
        ),
      });
      await ctx.reply(t('common.home', lang), {
        reply_markup: customerMainMenu(lang),
      });
      break;
    }
  }
}
