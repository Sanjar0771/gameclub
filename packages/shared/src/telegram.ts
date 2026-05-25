// ====================================================================
// Telegram WebApp initData validatsiyasi
// HMAC SHA256 orqali — har bir so'rov haqiqiy Telegramdan kelganini tekshiradi
// ====================================================================

import * as crypto from 'node:crypto';

export interface TelegramInitData {
  query_id?: string;
  user?: {
    id: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
  start_param?: string;
}

/**
 * initData stringini parse qilish va HMAC tekshirish.
 * @param initData Telegram WebAppdan kelgan raw initData string
 * @param botToken bot tokeni (sirli)
 * @param maxAgeSec qancha vaqt ichida initData yaroqli (default 1 soat)
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 3600,
): { valid: boolean; data?: TelegramInitData; error?: string } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false, error: 'hash missing' };

    params.delete('hash');

    // Data check string — kalitlar alfabetik tartibda
    const entries: [string, string][] = [];
    params.forEach((v, k) => entries.push([k, v]));
    const dataCheckString = entries
      .sort((a, b) => a[0]!.localeCompare(b[0]!))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Secret key = HMAC_SHA256(bot_token, "WebAppData")
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      return { valid: false, error: 'hash mismatch' };
    }

    // Age check
    const authDate = Number(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSec) {
      return { valid: false, error: 'initData expired' };
    }

    const userRaw = params.get('user');
    const data: TelegramInitData = {
      auth_date: authDate,
      hash,
      query_id: params.get('query_id') ?? undefined,
      start_param: params.get('start_param') ?? undefined,
      user: userRaw ? JSON.parse(userRaw) : undefined,
    };

    return { valid: true, data };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'parse error' };
  }
}
