// ====================================================================
// BOOKING LOGIC — narx hisoblash, slot generatsiya
// ====================================================================

import { SLOT_MINUTES, MIN_COMMISSION_PCT, MAX_COMMISSION_PCT } from './index';

export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Vaqtni 30 daqiqali slotga yaxlitlash (yuqoriga).
 * Masalan: 14:13 → 14:30, 14:35 → 15:00
 */
export function roundUpToSlot(date: Date): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const remainder = minutes % SLOT_MINUTES;
  if (remainder === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
    return d;
  }
  d.setMinutes(minutes + (SLOT_MINUTES - remainder));
  d.setSeconds(0, 0);
  return d;
}

/**
 * Vaqt slot ga to'g'ri keladimi tekshirish (faqat :00 yoki :30)
 */
export function isValidSlot(date: Date): boolean {
  return date.getMinutes() % SLOT_MINUTES === 0 && date.getSeconds() === 0;
}

/**
 * Ikki vaqt oralig'i bir-biri bilan kesishadimi
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * "HH:mm" stringini soat va daqiqaga aylantirish
 */
export function parseHHmm(s: string): { hours: number; minutes: number } {
  const [h, m] = s.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/**
 * Berilgan kun va "HH:mm" dan Date hosil qilish (Asia/Tashkent zonasi nazarda tutiladi)
 */
export function combineDateAndTime(date: Date, timeStr: string): Date {
  const { hours, minutes } = parseHHmm(timeStr);
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Berilgan filial uchun ish vaqti ichidagi slotlarni hosil qilish.
 */
export function generateSlots(params: {
  date: Date;
  openTime: string;
  closeTime: string;
  worksAroundClock?: boolean;
  occupiedRanges: TimeRange[];
  durationMinutes: number;
}): { start: Date; end: Date; available: boolean }[] {
  const { date, openTime, closeTime, worksAroundClock, occupiedRanges, durationMinutes } = params;
  const slots: { start: Date; end: Date; available: boolean }[] = [];

  const dayStart = worksAroundClock
    ? combineDateAndTime(date, '00:00')
    : combineDateAndTime(date, openTime);

  let dayEnd: Date;
  if (worksAroundClock) {
    dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
  } else {
    dayEnd = combineDateAndTime(date, closeTime);
    if (closeTime === '24:00' || dayEnd <= dayStart) {
      dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
    }
  }

  let cursor = roundUpToSlot(dayStart);
  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
    if (slotEnd > dayEnd) break;

    const overlaps = occupiedRanges.some((r) =>
      rangesOverlap({ start: cursor, end: slotEnd }, r),
    );
    slots.push({ start: new Date(cursor), end: slotEnd, available: !overlaps });

    cursor = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
  }

  return slots;
}

/**
 * Bron narxini hisoblash.
 * Kunduzgi va kechki vaqt aralashgan bo'lsa har bir qism alohida hisoblanadi.
 */
export function calculateBookingPrice(params: {
  startAt: Date;
  durationMinutes: number;
  dayPrice: number;
  nightPrice: number;
  dayStartTime: string;
  dayEndTime: string;
  isNightPackage?: boolean;
  nightPackagePrice?: number;
  discountPct?: number;
}): { basePrice: number; discountAmount: number; total: number } {
  let basePrice = 0;

  if (params.isNightPackage && params.nightPackagePrice) {
    basePrice = params.nightPackagePrice;
  } else {
    // Har 30 daqiqalik slotga qarab kunduzgi/kechki narx
    const slotCount = params.durationMinutes / SLOT_MINUTES;
    const slotPriceDay = params.dayPrice / 2; // 30 daqiqalik narx
    const slotPriceNight = params.nightPrice / 2;

    const { hours: dsH, minutes: dsM } = parseHHmm(params.dayStartTime);
    const { hours: deH, minutes: deM } = parseHHmm(params.dayEndTime);
    const dayStartMinutes = dsH * 60 + dsM;
    const dayEndMinutes = deH * 60 + deM;

    for (let i = 0; i < slotCount; i++) {
      const slotTime = new Date(params.startAt.getTime() + i * SLOT_MINUTES * 60_000);
      const slotMinutes = slotTime.getHours() * 60 + slotTime.getMinutes();
      const isDay =
        dayStartMinutes <= dayEndMinutes
          ? slotMinutes >= dayStartMinutes && slotMinutes < dayEndMinutes
          : slotMinutes >= dayStartMinutes || slotMinutes < dayEndMinutes;

      basePrice += isDay ? slotPriceDay : slotPriceNight;
    }
    basePrice = Math.round(basePrice);
  }

  const discountAmount = params.discountPct
    ? Math.round((basePrice * params.discountPct) / 100)
    : 0;
  const total = basePrice - discountAmount;

  return { basePrice, discountAmount, total };
}

/**
 * Komissiyani hisoblash
 */
export function calculateCommission(
  total: number,
  commissionPct: number,
): { commissionAmount: number; partnerAmount: number } {
  const pct = Math.max(MIN_COMMISSION_PCT, Math.min(MAX_COMMISSION_PCT, Number(commissionPct)));
  const commissionAmount = Math.round((total * pct) / 100);
  const partnerAmount = total - commissionAmount;
  return { commissionAmount, partnerAmount };
}

/**
 * Inson o'qiy oladigan bron kodi (8 belgi)
 */
export function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Pulni format qilish: 50000 → "50 000"
 */
export function formatPrice(amount: number): string {
  return amount.toLocaleString('ru-RU').replace(/,/g, ' ');
}

/**
 * Vaqtni format qilish: Date → "14:30"
 */
export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
