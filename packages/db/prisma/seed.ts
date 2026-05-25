import { PrismaClient, Role, Language } from '@prisma/client';
import * as crypto from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('🌱 Seeding boshlandi...');

  // === Super Admin ===
  const superAdminTelegramId = BigInt(process.env.SUPER_ADMIN_TELEGRAM_ID || '0');
  const superAdminLogin = process.env.SUPER_ADMIN_LOGIN || 'admin';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';

  if (superAdminTelegramId === BigInt(0)) {
    console.warn('⚠️  SUPER_ADMIN_TELEGRAM_ID o\'rnatilmagan — skip');
  } else {
    const user = await prisma.user.upsert({
      where: { telegramId: superAdminTelegramId },
      update: { role: Role.SUPER_ADMIN },
      create: {
        telegramId: superAdminTelegramId,
        role: Role.SUPER_ADMIN,
        language: Language.UZ,
        firstName: 'Super',
        lastName: 'Admin',
      },
    });

    await prisma.superAdmin.upsert({
      where: { userId: user.id },
      update: {
        login: superAdminLogin,
        passwordHash: hashPassword(superAdminPassword),
      },
      create: {
        userId: user.id,
        login: superAdminLogin,
        passwordHash: hashPassword(superAdminPassword),
      },
    });
    console.log('✅ Super Admin yaratildi/yangilandi');
  }

  // === Bot Texts ===
  const botTexts = [
    {
      key: 'welcome_customer',
      textUz: '👋 Assalomu alaykum! GameClub botiga xush kelibsiz.\n\n🎮 Bu yerda siz onlayn gameclublardan kompyuter bron qila olasiz.\n\nWebApp orqali davom eting:',
      textRu: '👋 Здравствуйте! Добро пожаловать в бот GameClub.\n\n🎮 Здесь вы можете забронировать компьютер в онлайн-геймклубах.\n\nПродолжите через WebApp:',
    },
    {
      key: 'welcome_partner_pending',
      textUz: '⏳ Sizning arizangiz ko\'rib chiqilmoqda.\n\nTez orada javob beramiz. Iltimos, kuting.',
      textRu: '⏳ Ваша заявка рассматривается.\n\nМы скоро ответим. Пожалуйста, подождите.',
    },
    {
      key: 'partner_approved',
      textUz: '🎉 Tabriklaymiz! Sizning arizangiz tasdiqlandi.\n\nEndi WebApp orqali gameclub va kompyuterlaringizni qo\'shishingiz mumkin.',
      textRu: '🎉 Поздравляем! Ваша заявка одобрена.\n\nТеперь вы можете добавить свой геймклуб и компьютеры через WebApp.',
    },
    {
      key: 'partner_rejected',
      textUz: '❌ Afsuski, sizning arizangiz rad etildi.\n\nSabab: {reason}',
      textRu: '❌ К сожалению, ваша заявка отклонена.\n\nПричина: {reason}',
    },
    {
      key: 'booking_payment_required',
      textUz: '💳 Bron yaratildi!\n\n📍 {branch}\n🖥 {computer}\n⏰ {start} — {end}\n💰 To\'lov: {amount} so\'m\n\nKarta: <code>{card}</code>\n\nTo\'lov qilib, chek screenshotni shu yerga yuboring.',
      textRu: '💳 Бронь создана!\n\n📍 {branch}\n🖥 {computer}\n⏰ {start} — {end}\n💰 Сумма: {amount} сум\n\nКарта: <code>{card}</code>\n\nОплатите и отправьте скриншот чека сюда.',
    },
    {
      key: 'booking_confirmed',
      textUz: '✅ To\'lov tasdiqlandi!\n\n📍 {branch}\n🖥 {computer}\n⏰ {start} — {end}\n\nQR-koddan foydalanib gameclubga kiring 👇',
      textRu: '✅ Оплата подтверждена!\n\n📍 {branch}\n🖥 {computer}\n⏰ {start} — {end}\n\nИспользуйте QR-код для входа в геймклуб 👇',
    },
    {
      key: 'booking_reminder',
      textUz: '⏰ Eslatma!\n\n30 daqiqadan keyin bronyingiz boshlanadi:\n📍 {branch}\n🖥 {computer}\n⏰ {start}',
      textRu: '⏰ Напоминание!\n\nЧерез 30 минут начинается ваша бронь:\n📍 {branch}\n🖥 {computer}\n⏰ {start}',
    },
    {
      key: 'rate_request',
      textUz: '⭐ Bronyingiz tugadi!\n\nGameclubni qanday baholaysiz?\n📍 {branch}',
      textRu: '⭐ Ваша бронь завершена!\n\nКак вы оцените геймклуб?\n📍 {branch}',
    },
    {
      key: 'language_choose',
      textUz: '🌐 Tilni tanlang:',
      textRu: '🌐 Выберите язык:',
    },
    {
      key: 'main_menu',
      textUz: '🎮 Asosiy menyu',
      textRu: '🎮 Главное меню',
    },
  ];

  for (const t of botTexts) {
    await prisma.botText.upsert({
      where: { key: t.key },
      update: { textUz: t.textUz, textRu: t.textRu },
      create: t,
    });
  }
  console.log(`✅ ${botTexts.length} ta bot matni yaratildi`);

  // === Settings ===
  const settings = [
    { key: 'default_commission_pct', value: '10' },
    { key: 'min_withdrawal_amount', value: '50000' }, // 50,000 so'm
    { key: 'booking_cancel_hours', value: '5' }, // 5 soat oldin bekor qilish mumkin
    { key: 'no_show_minutes', value: '30' }, // 30 daqiqadan keyin no-show
    { key: 'reminder_minutes', value: '30' }, // 30 daqiqa oldin eslatma
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`✅ ${settings.length} ta sozlama yaratildi`);

  console.log('🌱 Seeding tugadi!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
