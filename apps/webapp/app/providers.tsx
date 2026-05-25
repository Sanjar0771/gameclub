'use client';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyTelegramTheme, getTelegramWebApp, getInitData } from '@/lib/telegram';
import { loginWithTelegram, getAuthToken, api } from '@/lib/api';
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
  const authDone = useRef(false);
  const routedRef = useRef(false);

  // Auth — faqat bir marta
  useEffect(() => {
    if (authDone.current) return;
    authDone.current = true;

    async function tryAuth(retries = 5): Promise<void> {
      const initData = getInitData();

      // Agar initData hali yo'q bo'lsa — TG script yuklanmagan, kutamiz
      if (!initData && retries > 0) {
        await new Promise((r) => setTimeout(r, 200));
        return tryAuth(retries - 1);
      }

      if (!initData) {
        // Telegram tashqarisida (browser) — localStorage'dan token bor bo'lishi mumkin
        const existingToken = getAuthToken();
        if (existingToken) {
          try {
            const me = await api.get<AuthUser>('/api/common/me');
            if (me.ok) {
              setUser(me.data);
              setReady(true);
              return;
            }
          } catch {
            // token yaroqsiz
          }
        }
        setReady(true);
        return;
      }

      // Telegram ichida — initData bilan login
      const res = await loginWithTelegram();
      if (res.ok) {
        const me = await api.get<AuthUser>('/api/common/me');
        if (me.ok) {
          setUser(me.data);
        }
      }
      setReady(true);
    }

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

    tryAuth();
  }, [setReady, setUser]);

  // Routing — role bo'yicha yo'naltirish
  useEffect(() => {
    if (!isReady || routedRef.current) return;
    const user = useAuth.getState().user;
    if (!user) return;

    if (pathname === '/' || pathname === '') {
      routedRef.current = true;
      switch (user.role) {
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
  }, [isReady, pathname, router]);

  if (!isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-tg-bg">
        <div className="text-tg-hint">Yuklanmoqda...</div>
      </div>
    );
  }

  return <>{children}</>;
}
