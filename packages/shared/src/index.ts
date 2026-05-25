// ====================================================================
// SHARED TYPES, CONSTANTS, UTILS
// ====================================================================

export * from './telegram';
export * from './validators';
export * from './regions';
export * from './booking';
export * from './permissions';

// ============ Constants ============

export const SLOT_MINUTES = 30; // 30 daqiqali bloklar
export const MIN_BOOKING_MINUTES = 60; // minimum 1 soat
export const MAX_BOOKING_MINUTES = 720; // maksimum 12 soat
export const BOOKING_ADVANCE_DAYS = 7; // 7 kun oldin bron qilish mumkin
export const CANCEL_HOURS_BEFORE = 5; // 5 soat oldin bekor qilish mumkin
export const REMINDER_MINUTES_BEFORE = 30;
export const NO_SHOW_AFTER_MINUTES = 30;
export const MIN_WITHDRAWAL_AMOUNT = 50_000; // 50,000 so'm
export const MAX_ASSISTANTS_PER_BRANCH = 3;
export const MIN_COMMISSION_PCT = 5;
export const MAX_COMMISSION_PCT = 20;

export const CURRENCY = 'UZS';
export const TZ = 'Asia/Tashkent';

// ============ Roles ============

export type UserRole = 'SUPER_ADMIN' | 'PRE_ADMIN' | 'PARTNER' | 'ASSISTANT' | 'CUSTOMER';

export type Lang = 'UZ' | 'RU';

// ============ API Response Wrapper ============

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export const ApiError = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL: 'INTERNAL',
  BOOKING_SLOT_TAKEN: 'BOOKING_SLOT_TAKEN',
  BRANCH_CLOSED: 'BRANCH_CLOSED',
  COMPUTER_UNAVAILABLE: 'COMPUTER_UNAVAILABLE',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  PAYMENT_NOT_CONFIRMED: 'PAYMENT_NOT_CONFIRMED',
} as const;
