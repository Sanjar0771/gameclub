#!/bin/sh
set -e

echo "🔄 Running Prisma db push..."
cd /app/packages/db
npx prisma db push --skip-generate 2>&1 || echo "⚠️ Prisma db push failed, continuing..."

echo "🌱 Running seed (super admin + bot texts)..."
cd /app
node -e "
const { PrismaClient, Role, Language } = require('@gameclub/db');
const crypto = require('node:crypto');
const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

async function seed() {
  const tgId = BigInt(process.env.SUPER_ADMIN_TELEGRAM_ID || '0');
  const login = process.env.SUPER_ADMIN_LOGIN || 'admin';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';

  if (tgId === BigInt(0)) {
    console.log('⚠️ SUPER_ADMIN_TELEGRAM_ID not set');
    return;
  }

  const user = await prisma.user.upsert({
    where: { telegramId: tgId },
    update: { role: Role.SUPER_ADMIN },
    create: {
      telegramId: tgId,
      role: Role.SUPER_ADMIN,
      language: Language.UZ,
      firstName: 'Super',
      lastName: 'Admin',
    },
  });

  await prisma.superAdmin.upsert({
    where: { userId: user.id },
    update: { login: login, passwordHash: hashPassword(password) },
    create: { userId: user.id, login: login, passwordHash: hashPassword(password) },
  });
  console.log('✅ Super Admin ready');

  // Bot texts
  const texts = [
    { key: 'welcome_customer', textUz: '👋 Assalomu alaykum! GameClub botiga xush kelibsiz.', textRu: '👋 Добро пожаловать в бот GameClub.' },
    { key: 'language_choose', textUz: '🌐 Tilni tanlang:', textRu: '🌐 Выберите язык:' },
    { key: 'main_menu', textUz: '🎮 Asosiy menyu', textRu: '🎮 Главное меню' },
  ];
  for (const t of texts) {
    await prisma.botText.upsert({ where: { key: t.key }, update: {}, create: t });
  }
  console.log('✅ Bot texts ready');

  // Settings
  const settings = [
    { key: 'default_commission_pct', value: '10' },
    { key: 'min_withdrawal_amount', value: '50000' },
    { key: 'booking_cancel_hours', value: '5' },
    { key: 'no_show_minutes', value: '30' },
    { key: 'reminder_minutes', value: '30' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('✅ Settings ready');
}

seed().catch(e => console.error('Seed error:', e)).finally(() => prisma.\$disconnect());
" 2>&1 || echo "⚠️ Seed failed, continuing..."

echo "🚀 Starting server..."
cd /app/apps/server
exec node dist/index.js
