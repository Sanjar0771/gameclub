'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { hapticImpact } from '@/lib/telegram';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, showBack = true, backHref, right }: Props) {
  const router = useRouter();

  const handleBack = () => {
    hapticImpact('light');
    if (backHref) {
      router.push(backHref);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/customer');
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-tg-header-bg border-b border-tg-section-separator safe-pt">
      <div className="flex items-center gap-2 px-4 py-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full active:bg-tg-secondary-bg"
            aria-label="Orqaga"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate text-tg-text">{title}</h1>
          {subtitle && <p className="text-xs text-tg-hint truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
