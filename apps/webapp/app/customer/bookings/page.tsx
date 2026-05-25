'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { History as HistoryIcon, Clock, MapPin, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Badge } from '@/components/ui/common';
import { formatDateTime, formatPrice } from '@/lib/utils';
import { t } from '@gameclub/i18n';

export default function CustomerBookings() {
  const { lang } = useAuth();
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/customer/bookings');
      return res.ok ? res.data : [];
    },
  });

  const items = bookings ?? [];
  const active = items.filter((b) => ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED', 'ACTIVE'].includes(b.status));
  const past = items.filter((b) => !['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED', 'ACTIVE'].includes(b.status));

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Bronlarim' : 'Мои брони'} backHref="/customer" />

      <div className="px-4 py-4 space-y-6">
        {isLoading ? (
          <LoadingScreen />
        ) : items.length === 0 ? (
          <Empty
            icon={<HistoryIcon className="w-12 h-12" />}
            title={lang === 'UZ' ? 'Bronlar yo\'q' : 'Нет броней'}
            description={lang === 'UZ' ? 'Birinchi bronni qiling!' : 'Сделайте первую бронь!'}
          />
        ) : (
          <>
            {active.length > 0 && (
              <Section title={lang === 'UZ' ? 'Faol' : 'Активные'}>
                {active.map((b) => <BookingCard key={b.id} booking={b} lang={lang} />)}
              </Section>
            )}
            {past.length > 0 && (
              <Section title={lang === 'UZ' ? 'Tarix' : 'История'}>
                {past.map((b) => <BookingCard key={b.id} booking={b} lang={lang} />)}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BookingCard({ booking, lang }: { booking: any; lang: 'UZ' | 'RU' }) {
  const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
    PENDING_PAYMENT: 'warning',
    PAYMENT_REVIEW: 'info',
    CONFIRMED: 'success',
    ACTIVE: 'info',
    COMPLETED: 'default',
    NO_SHOW: 'danger',
    CANCELLED_BY_USER: 'danger',
    REJECTED_BY_CLUB: 'danger',
    REFUNDED: 'default',
    EXPIRED: 'danger',
  };

  const href =
    booking.status === 'PENDING_PAYMENT'
      ? `/customer/bookings/${booking.id}/pay`
      : `/customer/bookings/${booking.id}`;

  return (
    <Link href={href} className="block active:scale-[0.99] transition">
      <Card className="!p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="font-semibold">{booking.branch?.name}</div>
          <Badge variant={statusVariant[booking.status] ?? 'default'}>
            {t(`booking.statuses.${booking.status}`, lang)}
          </Badge>
        </div>
        <div className="space-y-1 text-xs text-tg-hint">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{booking.branch?.address}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDateTime(booking.startAt, lang)}</span>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-tg-section-separator">
          <span className="text-xs text-tg-hint">{booking.computer?.name}</span>
          <span className="font-semibold text-sm">{formatPrice(booking.totalAmount)} {lang === 'UZ' ? 'so\'m' : 'сум'}</span>
        </div>
      </Card>
    </Link>
  );
}
