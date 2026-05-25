import type { Bot } from 'grammy';
import { prisma, PartnerStatus, Role } from '@gameclub/db';
import type { BotContext } from '../index.js';
import { getDbUser, getLang, webAppButton, partnerMainMenu } from './_utils.js';
import { config } from '../../config.js';
import { audit } from '../../lib/audit.js';

export function registerPartnerHandlers(bot: Bot<BotContext>) {
  bot.command('register', async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);

    // Allaqachon hamkor bo'lsa
    if (user.role === 'SUPER_ADMIN' || user.role === 'PRE_ADMIN') {
      await ctx.reply(
        lang === 'UZ'
          ? '⚠️ Siz administratorsiz, hamkor sifatida ro\'yxatdan o\'tolmaysiz.'
          : '⚠️ Вы администратор, не можете зарегистрироваться как партнёр.',
      );
      return;
    }

    const existing = await prisma.partner.findUnique({ where: { userId: user.id } });
    if (existing && existing.status !== PartnerStatus.REJECTED) {
      const msg = {
        PENDING: lang === 'UZ' ? '⏳ Sizning arizangiz kutilmoqda.' : '⏳ Ваша заявка ожидает.',
        APPROVED: lang === 'UZ' ? '✅ Siz allaqachon hamkorsiz.' : '✅ Вы уже партнёр.',
        BANNED: lang === 'UZ' ? '🚫 Sizning akkauntingiz bloklangan.' : '🚫 Ваш аккаунт заблокирован.',
      } as const;
      await ctx.reply(msg[existing.status as keyof typeof msg] ?? '');
      return;
    }

    ctx.session.partnerReg = {};
    ctx.session.step = 'partner_fullName';

    await ctx.reply(
      lang === 'UZ'
        ? '📝 Hamkor sifatida ro\'yxatdan o\'tish\n\nIsm va familiyangizni kiriting:'
        : '📝 Регистрация партнёра\n\nВведите имя и фамилию:',
    );
  });

  bot.on('message:text', async (ctx, next) => {
    const user = await getDbUser(ctx);
    if (!user) return next();
    const lang = getLang(user);
    const text = ctx.message.text;

    if (ctx.session.step === 'partner_fullName') {
      if (text.length < 3 || text.length > 100) {
        await ctx.reply(
          lang === 'UZ' ? '❌ Ism noto\'g\'ri. Qaytadan kiriting:' : '❌ Неверное имя. Введите снова:',
        );
        return;
      }
      ctx.session.partnerReg = { fullName: text };
      ctx.session.step = 'partner_phone';
      await ctx.reply(
        lang === 'UZ'
          ? '📞 Telefon raqamingizni kiriting (+998XXXXXXXXX):'
          : '📞 Введите ваш телефон (+998XXXXXXXXX):',
      );
      return;
    }

    if (ctx.session.step === 'partner_phone') {
      if (!/^\+?998\d{9}$/.test(text.replace(/\s/g, ''))) {
        await ctx.reply(
          lang === 'UZ' ? '❌ Telefon noto\'g\'ri. Qaytadan kiriting:' : '❌ Неверный телефон. Введите снова:',
        );
        return;
      }
      const phone = text.replace(/\s/g, '');
      const reg = ctx.session.partnerReg ?? {};
      reg.phone = phone;

      // Partner yaratish
      await prisma.partner.create({
        data: {
          userId: user.id,
          fullName: reg.fullName ?? '',
          phone,
          status: PartnerStatus.PENDING,
        },
      });
      // Foydalanuvchi rolini PARTNERga o'zgartirish
      await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.PARTNER, phone },
      });

      ctx.session.step = undefined;
      ctx.session.partnerReg = undefined;

      await audit({
        actorId: user.id,
        actorRole: 'CUSTOMER',
        action: 'PARTNER_REGISTERED',
        targetType: 'Partner',
        targetId: user.id,
        metadata: { fullName: reg.fullName, phone },
      });

      // Super-adminga xabar
      try {
        await bot.api.sendMessage(
          config.SUPER_ADMIN_TELEGRAM_ID.toString(),
          `📬 Yangi hamkor arizasi\n\n👤 ${reg.fullName}\n📞 ${phone}\n🆔 ${ctx.from?.id}`,
          {
            reply_markup: webAppButton('🔍 Ko\'rish va tasdiqlash', '/admin/pending'),
          },
        );
      } catch (e) {
        // ignore
      }

      await ctx.reply(
        lang === 'UZ'
          ? '✅ Arizangiz qabul qilindi! Tasdiqlanishini kuting. Sizga albatta javob beramiz.'
          : '✅ Ваша заявка принята! Ожидайте подтверждения. Мы обязательно ответим.',
      );
      return;
    }

    return next();
  });

  // "🏢 Mening filiallarim"
  bot.hears(/^🏢 (Mening filiallarim|Мои филиалы)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);
    await ctx.reply(
      lang === 'UZ' ? '🏢 Filiallaringiz:' : '🏢 Ваши филиалы:',
      { reply_markup: webAppButton(lang === 'UZ' ? '🏢 Ochish' : '🏢 Открыть', '/partner/branches') },
    );
  });

  bot.hears(/^📊 (Statistika|Статистика)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user) return;
    const lang = getLang(user);
    if (user.role === 'PARTNER') {
      await ctx.reply(
        lang === 'UZ' ? '📊 Statistika:' : '📊 Статистика:',
        { reply_markup: webAppButton(lang === 'UZ' ? '📊 Ochish' : '📊 Открыть', '/partner/stats') },
      );
    } else if (user.role === 'SUPER_ADMIN' || user.role === 'PRE_ADMIN') {
      await ctx.reply(
        lang === 'UZ' ? '📊 Statistika:' : '📊 Статистика:',
        { reply_markup: webAppButton(lang === 'UZ' ? '📊 Ochish' : '📊 Открыть', '/admin/stats') },
      );
    }
  });

  bot.hears(/^💰 (Balans|Баланс)$/, async (ctx) => {
    const user = await getDbUser(ctx);
    if (!user || user.role !== 'PARTNER') return;
    const lang = getLang(user);
    await ctx.reply(
      lang === 'UZ' ? '💰 Balans va yechib olish:' : '💰 Баланс и вывод:',
      { reply_markup: webAppButton(lang === 'UZ' ? '💰 Ochish' : '💰 Открыть', '/partner/balance') },
    );
  });
}
