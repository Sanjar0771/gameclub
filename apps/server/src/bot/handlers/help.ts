import type { Bot } from 'grammy';
import { prisma, ComplaintStatus } from '@gameclub/db';
import type { BotContext } from '../index.js';
import { getDbUser, getLang } from './_utils.js';

export function registerHelpHandler(bot: Bot<BotContext>) {
  bot.command('help', async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    await ctx.reply(
      lang === 'UZ'
        ? '🆘 Yordam\n\nMuammo yoki savol bo\'lsa, yozib qoldiring — adminlar javob beradi.\n\n/complaint — shikoyat yozish\n/language — tilni o\'zgartirish\n/start — bosh menyu'
        : '🆘 Помощь\n\nЕсли есть проблема или вопрос — напишите, администраторы ответят.\n\n/complaint — оставить жалобу\n/language — сменить язык\n/start — главное меню',
    );
  });

  bot.command('complaint', async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    ctx.session.complaint = {};
    ctx.session.step = 'complaint_subject';

    await ctx.reply(
      lang === 'UZ'
        ? '📝 Shikoyat mavzusini yozing (qisqacha, masalan: "To\'lov muammosi"):'
        : '📝 Напишите тему жалобы (кратко, например: "Проблема с оплатой"):',
    );
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step === 'complaint_subject') {
      const user = await getDbUser(ctx);
      if (!user) return;
      const lang = getLang(user);

      ctx.session.complaint = { subject: ctx.message.text.slice(0, 200) };
      ctx.session.step = 'complaint_message';

      await ctx.reply(
        lang === 'UZ'
          ? '✍️ Endi muammoni batafsil yozing:'
          : '✍️ Теперь подробно опишите проблему:',
      );
      return;
    }

    if (ctx.session.step === 'complaint_message') {
      const user = await getDbUser(ctx);
      if (!user) return;
      const lang = getLang(user);

      await prisma.complaint.create({
        data: {
          customerId: user.id,
          subject: ctx.session.complaint?.subject ?? 'Shikoyat',
          message: ctx.message.text.slice(0, 2000),
          status: ComplaintStatus.OPEN,
        },
      });

      ctx.session.step = undefined;
      ctx.session.complaint = undefined;

      await ctx.reply(
        lang === 'UZ'
          ? '✅ Shikoyatingiz qabul qilindi. Tez orada javob olasiz.'
          : '✅ Ваша жалоба принята. Скоро вы получите ответ.',
      );
      return;
    }

    return next();
  });
}
