'use client';

import { create } from 'zustand';
import type { Lang } from '@gameclub/i18n';

export interface AuthUser {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  language: Lang;
  role: 'SUPER_ADMIN' | 'PRE_ADMIN' | 'PARTNER' | 'ASSISTANT' | 'CUSTOMER';
  phone?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  lang: Lang;
  isReady: boolean;
  setUser: (u: AuthUser | null) => void;
  setLang: (l: Lang) => void;
  setReady: (r: boolean) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  lang: 'UZ',
  isReady: false,
  setUser: (user) => set({ user, lang: user?.language ?? 'UZ' }),
  setLang: (lang) => set({ lang }),
  setReady: (isReady) => set({ isReady }),
}));
