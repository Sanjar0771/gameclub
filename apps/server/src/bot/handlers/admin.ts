import type { Bot } from 'grammy';
import type { BotContext } from '../index.js';
import { getDbUser, getLang, webAppButton } from './_utils.js';

export function registerAdminHandlers(bot: Bot<BotContext>) {
  bot.hears(/^💳 (To'lovlar|Платежи)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'PRE_ADMIN')) return;
    const lang = getLang(user);
    await ctx.reply(
      lang === 'UZ' ? '💳 To\'lovlarni tekshirish:' : '💳 Проверка платежей:',
      { reply_markup: webAppButton(lang === 'UZ' ? '💳 Ochish' : '💳 Открыть', '/admin/payments') },
    );
  });

  bot.hears(/^👥 (Hamkorlar|Партнёры)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'PRE_ADMIN')) return;
    const lang = getLang(user);
    await ctx.reply(
      lang === 'UZ' ? '👥 Hamkorlar ro\'yxati:' : '👥 Список партнёров:',
      { reply_markup: webAppButton(lang === 'UZ' ? '👥 Ochish' : '👥 Открыть', '/admin/partners') },
    );
  });

  bot.hears(/^📨 (Arizalar|Заявки)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'PRE_ADMIN')) return;
    const lang = getLang(user);
    await ctx.reply(
      lang === 'UZ' ? '📨 Kutilayotgan arizalar:' : '📨 Ожидающие заявки:',
      { reply_markup: webAppButton(lang === 'UZ' ? '📨 Ochish' : '📨 Открыть', '/admin/pending') },
    );
  });

  bot.hears(/^💰 (Yechib olish|Выводы)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user || user.role !== 'SUPER_ADMIN') return;
    const lang = getLang(user);
    await ctx.reply(
      lang === 'UZ' ? '💰 Yechib olish so\'rovlari:' : '💰 Запросы на вывод:',
      { reply_markup: webAppButton(lang === 'UZ' ? '💰 Ochish' : '💰 Открыть', '/admin/withdrawals') },
    );
  });

  bot.hears(/^📢 (Broadcast|Рассылка)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user || user.role !== 'SUPER_ADMIN') return;
    const lang = getLang(user);
    await ctx.reply(
      lang === 'UZ' ? '📢 Ommaviy xabar yuborish:' : '📢 Массовая рассылка:',
      { reply_markup: webAppButton(lang === 'UZ' ? '📢 Ochish' : '📢 Открыть', '/admin/broadcast') },
    );
  });
}
