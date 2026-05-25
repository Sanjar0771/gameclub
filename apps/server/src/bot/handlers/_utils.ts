import { InlineKeyboard, Keyboard } from 'grammy';
import { type Lang } from '@gameclub/i18n';
import { config } from '../../config.js';
import type { BotContext } from '../index.js';
import { prisma, type User } from '@gameclub/db';

export async function getDbUser(ctx: BotContext): Promise<User | null> {
  const cached = (ctx as any).dbUser as User | undefined;
  if (cached) return cached;
  if (!ctx.from) return null;
  return prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
}

export function getLang(user: { language: 'UZ' | 'RU' } | null): Lang {
  return (user?.language ?? 'UZ') as Lang;
}

export function langKeyboard() {
  return new InlineKeyboard()
    .text('🇺🇿 O\'zbekcha', 'lang:UZ')
    .text('🇷🇺 Русский', 'lang:RU');
}

export function webAppButton(label: string, path = '') {
  const url = `${config.WEBAPP_URL}${path}`;
  return new InlineKeyboard().webApp(label, url);
}

export function customerMainMenu(lang: Lang) {
  const kb = new Keyboard()
    .text(lang === 'UZ' ? '🎮 Gameclub topish' : '🎮 Найти геймклуб')
    .row()
    .text(lang === 'UZ' ? '📋 Mening bronlarim' : '📋 Мои брони')
    .text(lang === 'UZ' ? '❤️ Sevimlilar' : '❤️ Избранное')
    .row()
    .text(lang === 'UZ' ? '🆘 Yordam' : '🆘 Помощь')
    .text(lang === 'UZ' ? '⚙️ Sozlamalar' : '⚙️ Настройки');
  return kb.resized();
}

export function partnerMainMenu(lang: Lang) {
  const kb = new Keyboard()
    .text(lang === 'UZ' ? '🏢 Mening filiallarim' : '🏢 Мои филиалы')
    .row()
    .text(lang === 'UZ' ? '📊 Statistika' : '📊 Статистика')
    .text(lang === 'UZ' ? '💰 Balans' : '💰 Баланс')
    .row()
    .text(lang === 'UZ' ? '⚙️ Sozlamalar' : '⚙️ Настройки');
  return kb.resized();
}

export function adminMainMenu(lang: Lang) {
  const kb = new Keyboard()
    .text(lang === 'UZ' ? '👥 Hamkorlar' : '👥 Партнёры')
    .text(lang === 'UZ' ? '📨 Arizalar' : '📨 Заявки')
    .row()
    .text(lang === 'UZ' ? '📊 Statistika' : '📊 Статистика')
    .text(lang === 'UZ' ? '💰 Yechib olish' : '💰 Выводы')
    .row()
    .text(lang === 'UZ' ? '📢 Broadcast' : '📢 Рассылка')
    .text(lang === 'UZ' ? '⚙️ Sozlamalar' : '⚙️ Настройки');
  return kb.resized();
}

export function assistantMainMenu(lang: Lang) {
  const kb = new Keyboard()
    .text(lang === 'UZ' ? '🎮 Filial' : '🎮 Филиал')
    .row()
    .text(lang === 'UZ' ? '📋 Bronlar' : '📋 Брони')
    .text(lang === 'UZ' ? '⚙️ Sozlamalar' : '⚙️ Настройки');
  return kb.resized();
}
