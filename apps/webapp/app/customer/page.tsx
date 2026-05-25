'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Heart, History, Search, MapPin, HelpCircle, Settings, Gamepad2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { t } from '@gameclub/i18n';

export default function CustomerHome() {
  const { lang, user } = useAuth();

  const { data: bookings } = useQuery({
    queryKey: ['my-bookings-summary'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/customer/bookings');
      return res.ok ? res.data : [];
    },
  });

  const activeBookings = (bookings ?? []).filter((b) =>
    ['CONFIRMED', 'ACTIVE', 'PENDING_PAYMENT', 'PAYMENT_REVIEW'].includes(b.status),
  );

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 text-white px-5 pt-12 pb-8 safe-pt">
        <div className="flex items-center gap-3 mb-1">
          <Gamepad2 className="w-7 h-7" />
          <span className="text-sm opacity-80">GameClub</span>
        </div>
        <h1 className="text-2xl font-bold">
          {lang === 'UZ' ? `Salom${user?.firstName ? ', ' + user.firstName : ''}!` : `Привет${user?.firstName ? ', ' + user.firstName : ''}!`}
        </h1>
        <p className="text-white/80 mt-1 text-sm">
          {lang === 'UZ' ? 'Yaqin atrofda kompyuter toping va bron qiling' : 'Найдите компьютер рядом и забронируйте'}
        </p>
      </div>

      <div className="px-4 -mt-4">
        <Link
          href="/customer/search"
          className="flex items-center gap-3 bg-tg-section-bg rounded-2xl px-4 py-4 shadow-lg active:scale-[0.98] transition"
        >
          <Search className="w-5 h-5 text-tg-hint" />
          <span className="text-tg-hint">{lang === 'UZ' ? 'Gameclub qidirish...' : 'Найти геймклуб...'}</span>
        </Link>
      </div>

      {activeBookings.length > 0 && (
        <div className="mt-6 px-4">
          <h2 className="text-base font-semibold mb-3">
            {lang === 'UZ' ? '🎯 Faol bronlar' : '🎯 Активные брони'}
          </h2>
          <div className="space-y-2">
            {activeBookings.slice(0, 3).map((b) => (
              <Link
                key={b.id}
                href={`/customer/bookings`}
                className="card flex items-center gap-3 active:scale-[0.99] transition"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{b.branch?.name}</div>
                  <div className="text-xs text-tg-hint">
                    {t(`booking.statuses.${b.status}`, lang)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 px-4">
        <h2 className="text-base font-semibold mb-3">
          {lang === 'UZ' ? 'Tezkor ochish' : 'Быстрый доступ'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <MenuTile href="/customer/search?sort=distance" icon={<MapPin />} label={lang === 'UZ' ? 'Yaqinlar' : 'Рядом'} />
          <MenuTile href="/customer/bookings" icon={<History />} label={lang === 'UZ' ? 'Bronlarim' : 'Мои брони'} />
          <MenuTile href="/customer/favorites" icon={<Heart />} label={lang === 'UZ' ? 'Sevimlilar' : 'Избранное'} />
          <MenuTile href="/customer/settings" icon={<Settings />} label={lang === 'UZ' ? 'Sozlamalar' : 'Настройки'} />
        </div>
      </div>
    </div>
  );
}

function MenuTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center justify-center gap-2 py-6 active:scale-95 transition"
    >
      <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600">
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
