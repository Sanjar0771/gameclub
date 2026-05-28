import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TZ: z.string().default('Asia/Tashkent'),

  // Database
  DATABASE_URL: z.string().min(10),

  // Bot
  BOT_TOKEN: z.string().min(20),
  BOT_USERNAME: z.string().min(3).default('gameclub_bot'),
  WEBAPP_URL: z.string().url(),

  // Super Admin
  SUPER_ADMIN_TELEGRAM_ID: z.string().transform((v) => BigInt(v)),
  SUPER_ADMIN_LOGIN: z.string().default('admin'),
  SUPER_ADMIN_PASSWORD: z.string().min(6),

  // API (Railway sets PORT automatically)
  PORT: z.string().optional(),
  API_PORT: z.string().default('3001').transform(Number),
  API_HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Platforma kartasi (barcha to'lovlar shu kartaga tushadi)
  PLATFORM_CARD_NUMBER: z.string().min(16).optional(),
  PLATFORM_CARD_HOLDER: z.string().optional(),

  // QR
  QR_SECRET: z.string().min(32).optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

export const config = (() => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Noto\'g\'ri ENV variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
})();

export const isProd = config.NODE_ENV === 'production';
export const isDev = config.NODE_ENV === 'development';
