'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/customer');
      return;
    }
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
  }, [user, isReady, router]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-tg-bg">
      <div className="text-tg-hint">Yuklanmoqda...</div>
    </div>
  );
}
