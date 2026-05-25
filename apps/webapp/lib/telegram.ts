'use client';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        themeParams: Record<string, string>;
        colorScheme: 'light' | 'dark';
        viewportHeight: number;
        viewportStableHeight: number;
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          setText: (text: string) => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        showAlert: (msg: string, cb?: () => void) => void;
        showConfirm: (msg: string, cb: (confirmed: boolean) => void) => void;
        showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text: string }> }, cb?: (id: string) => void) => void;
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
        sendData: (data: string) => void;
        requestContact?: (cb: (shared: boolean, info: any) => void) => void;
      };
    };
  }
}

export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotification(type: 'error' | 'success' | 'warning') {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
}

export function showAlert(msg: string): Promise<void> {
  return new Promise((resolve) => {
    const tg = getTelegramWebApp();
    if (tg?.showAlert) tg.showAlert(msg, () => resolve());
    else {
      alert(msg);
      resolve();
    }
  });
}

export function showConfirm(msg: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = getTelegramWebApp();
    if (tg?.showConfirm) tg.showConfirm(msg, (ok) => resolve(ok));
    else resolve(confirm(msg));
  });
}

export function applyTelegramTheme() {
  const tg = getTelegramWebApp();
  if (!tg) return;
  const params = tg.themeParams;
  const root = document.documentElement;
  if (params.bg_color) root.style.setProperty('--tg-bg', params.bg_color);
  if (params.secondary_bg_color) root.style.setProperty('--tg-secondary-bg', params.secondary_bg_color);
  if (params.text_color) root.style.setProperty('--tg-text', params.text_color);
  if (params.hint_color) root.style.setProperty('--tg-hint', params.hint_color);
  if (params.link_color) root.style.setProperty('--tg-link', params.link_color);
  if (params.button_color) root.style.setProperty('--tg-button', params.button_color);
  if (params.button_text_color) root.style.setProperty('--tg-button-text', params.button_text_color);
  if (params.header_bg_color) root.style.setProperty('--tg-header-bg', params.header_bg_color);
  if (params.section_bg_color) root.style.setProperty('--tg-section-bg', params.section_bg_color);
  if (params.section_separator_color) root.style.setProperty('--tg-section-separator', params.section_separator_color);
  if (params.accent_text_color) root.style.setProperty('--tg-accent', params.accent_text_color);
  if (params.destructive_text_color) root.style.setProperty('--tg-destructive', params.destructive_text_color);
}
