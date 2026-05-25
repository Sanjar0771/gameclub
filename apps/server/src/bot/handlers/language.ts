import type { Bot } from 'grammy';
import { prisma, Language } from '@gameclub/db';
import type { BotContext } from '../index.js';
import { getDbUser, langKeyboard, customerMainMenu, partnerMainMenu, adminMainMenu, assistantMainMenu } from './_utils.js';

export function registerLanguageHandler(bot: Bot<BotContext>) {
  bot.command('language', async (ctx) => {
    await ctx.reply('🌐 Tilni tanlang / Выберите язык:', {
      reply_markup: langKeyboard(),
    });
  });

  bot.callbackQuery(/^lang:(UZ|RU)$/, async (ctx) => {
    const lang = ctx.match[1] as 'UZ' | 'RU';
    const user = await getDbUser(ctx);
    if (!user) return;

    await prisma.user.update({
      where: { id: user.id },
      data: { language: lang as Language },
    });

    await ctx.answerCallbackQuery();
    const text = lang === 'UZ' ? '✅ Til o\'zgartirildi: O\'zbekcha' : '✅ Язык изменён: Русский';
    await ctx.editMessageText(text);

    // Asosiy menyuga qaytarish
    let menu;
    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'PRE_ADMIN':
        menu = adminMainMenu(lang);
        break;
      case 'PARTNER':
        menu = partnerMainMenu(lang);
        break;
      case 'ASSISTANT':
        menu = assistantMainMenu(lang);
        break;
      default:
        menu = customerMainMenu(lang);
    }
    await ctx.reply(lang === 'UZ' ? '🎮 Asosiy menyu' : '🎮 Главное меню', {
      reply_markup: menu,
    });
  });
}
