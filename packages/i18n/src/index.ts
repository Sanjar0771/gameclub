import { uz } from './locales/uz';
import { ru } from './locales/ru';

export const locales = { UZ: uz, RU: ru } as const;

export type Lang = 'UZ' | 'RU';

type DotPath<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? `${K}.${DotPath<T[K]>}`
    : K
  : never;

export type TranslationKey = DotPath<typeof uz>;

/**
 * Tarjima olish: t('common.yes', 'UZ') → 'Ha'
 * Va o'rinbosarlar bilan: t('booking.template', 'UZ', { branch: 'Foo' })
 */
export function t(
  key: string,
  lang: Lang = 'UZ',
  vars?: Record<string, string | number>,
): string {
  const locale = locales[lang] ?? locales.UZ;
  const parts = key.split('.');
  let cur: any = locale;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      return key;
    }
  }
  if (typeof cur !== 'string') return key;
  if (vars) {
    return cur.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  }
  return cur;
}

export { uz, ru };
