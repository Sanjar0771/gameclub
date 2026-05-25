import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return amount.toLocaleString('ru-RU').replace(/,/g, ' ');
}

export function formatDateTime(d: string | Date, lang: 'UZ' | 'RU' = 'UZ'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString(lang === 'UZ' ? 'uz-UZ' : 'ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(d: string | Date, lang: 'UZ' | 'RU' = 'UZ'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(lang === 'UZ' ? 'uz-UZ' : 'ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
