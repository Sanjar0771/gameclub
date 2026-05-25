import { z } from 'zod';

// ============ Common ============
export const idSchema = z.string().cuid();
export const phoneSchema = z
  .string()
  .regex(/^\+?998\d{9}$/, 'Telefon raqami noto\'g\'ri (+998XXXXXXXXX)');
export const cardSchema = z.string().regex(/^\d{16}$/, 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak');

// ============ Auth ============
export const loginSchema = z.object({
  login: z.string().min(3).max(50),
  password: z.string().min(6),
});

// ============ Partner Registration ============
export const partnerRegisterSchema = z.object({
  fullName: z.string().min(3).max(100),
  phone: phoneSchema,
});

// ============ Branch ============
export const branchCreateSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  region: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(5).max(300),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: phoneSchema.optional(),
  cardNumber: cardSchema,
  cardHolderName: z.string().max(100).optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  worksAroundClock: z.boolean().optional(),
});

export const branchUpdateSchema = branchCreateSchema.partial();

// ============ Computer Type ============
export const computerTypeSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(300).optional(),
  dayPrice: z.number().int().positive(),
  nightPrice: z.number().int().positive(),
  dayStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  dayEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  hasNightPackage: z.boolean().optional(),
  nightPackagePrice: z.number().int().positive().optional(),
  nightPackageStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  nightPackageEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// ============ Computer ============
export const computerCreateSchema = z.object({
  typeId: idSchema,
  name: z.string().min(1).max(20),
  description: z.string().max(200).optional(),
});

// ============ Booking ============
export const bookingCreateSchema = z.object({
  computerId: idSchema,
  startAt: z.string().datetime(),
  durationMinutes: z.number().int().min(60).max(720),
  isNightPackage: z.boolean().optional(),
  promotionId: idSchema.optional(),
});

// ============ Withdrawal ============
export const withdrawalRequestSchema = z.object({
  branchId: idSchema,
  amount: z.number().int().positive(),
});

// ============ Rating ============
export const ratingSchema = z.object({
  bookingId: idSchema,
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// ============ Complaint ============
export const complaintSchema = z.object({
  branchId: idSchema.optional(),
  bookingId: idSchema.optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(2000),
});

// ============ Promotion ============
export const promotionSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  discountPct: z.number().int().min(1).max(100),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  firstBookingOnly: z.boolean().optional(),
  minAmount: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().optional(),
});

// ============ Assistant Permissions ============
export const assistantPermissionsSchema = z.object({
  canViewBookings: z.boolean(),
  canConfirmQr: z.boolean(),
  canRejectBooking: z.boolean(),
  canMarkNoShow: z.boolean(),
  canManageComputers: z.boolean(),
  canChangePrices: z.boolean(),
  canChangeWorkHours: z.boolean(),
  canCloseBranch: z.boolean(),
  canViewIncome: z.boolean(),
  canManagePromotions: z.boolean(),
  canViewComplaints: z.boolean(),
});

export const assistantCreateSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  branchId: idSchema,
  permissions: assistantPermissionsSchema.partial().optional(),
});
