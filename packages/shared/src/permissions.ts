import type { UserRole } from './index';

export interface AssistantPermissions {
  canViewBookings: boolean;
  canConfirmQr: boolean;
  canRejectBooking: boolean;
  canMarkNoShow: boolean;
  canManageComputers: boolean;
  canChangePrices: boolean;
  canChangeWorkHours: boolean;
  canCloseBranch: boolean;
  canViewIncome: boolean;
  canManagePromotions: boolean;
  canViewComplaints: boolean;
}

export const DEFAULT_ASSISTANT_PERMISSIONS: AssistantPermissions = {
  canViewBookings: true,
  canConfirmQr: true,
  canRejectBooking: true,
  canMarkNoShow: true,
  canManageComputers: false,
  canChangePrices: false,
  canChangeWorkHours: false,
  canCloseBranch: false,
  canViewIncome: false,
  canManagePromotions: false,
  canViewComplaints: true,
};

export function isAdminRole(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'PRE_ADMIN';
}

export function isPartnerSide(role: UserRole): boolean {
  return role === 'PARTNER' || role === 'ASSISTANT';
}

/**
 * Marshrut huquqlari (qaysi rol qaysi API'ga kira oladi)
 */
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['/api/admin', '/api/super-admin', '/api/common'],
  PRE_ADMIN: ['/api/admin', '/api/pre-admin', '/api/common'],
  PARTNER: ['/api/partner', '/api/common'],
  ASSISTANT: ['/api/assistant', '/api/common'],
  CUSTOMER: ['/api/customer', '/api/common'],
};
