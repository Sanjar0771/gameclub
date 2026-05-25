import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';
import { log } from './logger.js';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials missing');
  }
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

/**
 * Telegramdan file URL olish
 */
export async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.BOT_TOKEN}/getFile?file_id=${fileId}`,
    );
    const data: any = await res.json();
    if (!data.ok || !data.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${data.result.file_path}`;
  } catch (e) {
    log.error('Telegram file URL error', e);
    return null;
  }
}

/**
 * Cloudinary'ga yuklash (URL orqali)
 */
export async function uploadToCloudinary(
  source: string,
  options: { folder?: string; publicId?: string } = {},
): Promise<{ url: string; publicId: string } | null> {
  try {
    ensureConfigured();
    const result = await cloudinary.uploader.upload(source, {
      folder: options.folder ?? 'gameclub/receipts',
      public_id: options.publicId,
      resource_type: 'auto',
      overwrite: false,
      use_filename: true,
      unique_filename: true,
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (e) {
    log.error('Cloudinary upload error', e);
    return null;
  }
}

/**
 * Telegram file_id → Cloudinary URL (to'la pipeline)
 */
export async function uploadTelegramFileToCloudinary(
  fileId: string,
  folder = 'gameclub/receipts',
): Promise<string | null> {
  const tgUrl = await getTelegramFileUrl(fileId);
  if (!tgUrl) return null;
  const result = await uploadToCloudinary(tgUrl, { folder });
  return result?.url ?? null;
}
