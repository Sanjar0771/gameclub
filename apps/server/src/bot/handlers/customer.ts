import type { Bot } from 'grammy';
import type { BotContext } from '../index.js';
import { getDbUser, getLang, webAppButton, customerMainMenu } from './_utils.js';

export function registerCustomerHandlers(bot: Bot<BotContext>) {
  // "🎮 Gameclub topish"
  bot.hears(/^🎮 (Gameclub topish|Найти геймклуб)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    await ctx.reply(
      lang === 'UZ'
        ? '🎮 Yaqin atrofdagi gameclublarni ko\'rish uchun WebApp\'ni oching:'
        : '🎮 Откройте WebApp, чтобы увидеть ближайшие геймклубы:',
      { reply_markup: webAppButton(lang === 'UZ' ? '🔍 Qidirish' : '🔍 Найти', '/customer/search') },
    );
  });

  // "📋 Mening bronlarim"
  bot.hears(/^📋 (Mening bronlarim|Мои брони)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    await ctx.reply(
      lang === 'UZ' ? '📋 Bronlaringiz:' : '📋 Ваши брони:',
      { reply_markup: webAppButton(lang === 'UZ' ? '📋 Bronlarim' : '📋 Мои брони', '/customer/bookings') },
    );
  });

  // "❤️ Sevimlilar"
  bot.hears(/^❤️ (Sevimlilar|Избранное)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    await ctx.reply(
      lang === 'UZ' ? '❤️ Sevimli gameclublaringiz:' : '❤️ Ваши избранные геймклубы:',
      { reply_markup: webAppButton(lang === 'UZ' ? '❤️ Ochish' : '❤️ Открыть', '/customer/favorites') },
    );
  });

  // "🆘 Yordam"
  bot.hears(/^🆘 (Yordam|Помощь)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    await ctx.reply(
      lang === 'UZ'
        ? '🆘 Yordam kerakmi?\n\n/complaint — shikoyat yozish\n/language — tilni o\'zgartirish'
        : '🆘 Нужна помощь?\n\n/complaint — оставить жалобу\n/language — сменить язык',
    );
  });

  // "⚙️ Sozlamalar"
  bot.hears(/^⚙️ (Sozlamalar|Настройки)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    await ctx.reply(
      lang === 'UZ' ? '⚙️ Sozlamalar:' : '⚙️ Настройки:',
      { reply_markup: webAppButton(lang === 'UZ' ? '⚙️ Ochish' : '⚙️ Открыть', '/customer/settings') },
    );
  });
}
