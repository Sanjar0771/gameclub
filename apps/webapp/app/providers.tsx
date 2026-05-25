'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyTelegramTheme, getTelegramWebApp, getInitData } from '@/lib/telegram';
import { loginWithTelegram, api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/store';
import { useRouter, usePathname } from 'next/navigation';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <TelegramAuthBoot>{children}</TelegramAuthBoot>
    </QueryClientProvider>
  );
}

function TelegramAuthBoot({ children }: { children: React.ReactNode }) {
  const { setUser, setReady, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        applyTelegramTheme();
      } catch {
        // ignore
      }
    }

    (async () => {
      const initData = getInitData();
      if (!initData) {
        // Browser (Telegram tashqarisida) — demo rejimi
        setReady(true);
        return;
      }
      const res = await loginWithTelegram();
      if (res.ok) {
        const me = await api.get<AuthUser>('/api/common/me');
        if (me.ok) {
          setUser(me.data);
          // Default route by role
          if (pathname === '/' || pathname === '') {
            switch (me.data.role) {
              case 'SUPER_ADMIN':
              case 'PRE_ADMIN':
                router.replace('/admin');
                break;
              case 'PARTNER':
                router.replace('/partner');
                break;
              case 'ASSISTANT':
                router.replace('/assistant');
                break;
              default:
                router.replace('/customer');
            }
          }
        }
      }
      setReady(true);
    })();
  }, [pathname, router, setReady, setUser]);

  if (!isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-tg-bg">
        <div className="text-tg-hint">Yuklanmoqda...</div>
      </div>
    );
  }

  return <>{children}</>;
}
