'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Clock, Hash, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen, Badge, Stars } from '@/components/ui/common';
import { formatDateTime, formatPrice, cn } from '@/lib/utils';
import { hapticImpact, hapticNotification, showAlert, showConfirm } from '@/lib/telegram';
import { t } from '@gameclub/i18n';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [showRating, setShowRating] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const { data: bookings } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/customer/bookings');
      return res.ok ? res.data : [];
    },
  });

  const booking = bookings?.find((b) => b.id === id);

  if (!booking) return <LoadingScreen />;

  const cancel = async () => {
    const ok = await showConfirm(
      lang === 'UZ' ? 'Bronni bekor qilishni xohlaysizmi?' : 'Отменить бронь?',
    );
    if (!ok) return;
    hapticImpact('medium');
    const res = await api.post(`/api/customer/bookings/${id}/cancel`);
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      await showAlert(lang === 'UZ' ? 'Bekor qilindi' : 'Отменено');
    } else {
      hapticNotification('error');
      await showAlert(res.error.message);
    }
  };

  const submitRating = async () => {
    if (stars === 0) return;
    hapticImpact('light');
    const res = await api.post('/api/customer/ratings', {
      bookingId: booking.id,
      stars,
      comment: comment || undefined,
    });
    if (res.ok) {
      hapticNotification('success');
      setShowRating(false);
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
    } else {
      await showAlert(res.error.message);
    }
  };

  const canCancel = ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED'].includes(booking.status);
  const canRate = ['COMPLETED', 'NO_SHOW'].includes(booking.status) && !booking.rating;
  const showQr = booking.status === 'CONFIRMED' || booking.status === 'ACTIVE';

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Bron tafsiloti' : 'Детали брони'} />

      <div className="px-4 py-4 space-y-4">
        <Card>
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-lg font-semibold">{booking.branch?.name}</h2>
            <Badge>{t(`booking.statuses.${booking.status}`, lang)}</Badge>
          </div>
          <div className="space-y-2 text-sm">
            <Row icon={<Hash className="w-4 h-4" />} label={lang === 'UZ' ? 'Bron kodi' : 'Код брони'} value={booking.code} />
            <Row icon={<MapPin className="w-4 h-4" />} label={lang === 'UZ' ? 'Manzil' : 'Адрес'} value={booking.branch?.address} />
            <Row icon={<Clock className="w-4 h-4" />} label={lang === 'UZ' ? 'Vaqt' : 'Время'} value={formatDateTime(booking.startAt, lang)} />
            <Row label={lang === 'UZ' ? 'Kompyuter' : 'Компьютер'} value={`${booking.computer?.name} (${booking.computer?.type?.name})`} />
            <Row label={lang === 'UZ' ? 'Davomiylik' : 'Длительность'} value={`${booking.durationMinutes / 60} ${lang === 'UZ' ? 'soat' : 'ч'}`} />
            <Row label={lang === 'UZ' ? 'Summa' : 'Сумма'} value={`${formatPrice(booking.totalAmount)} ${lang === 'UZ' ? 'so\'m' : 'сум'}`} accent />
          </div>
        </Card>

        {showQr && (
          <Card>
            <h3 className="font-semibold mb-2">{lang === 'UZ' ? 'QR-kod' : 'QR-код'}</h3>
            <p className="text-xs text-tg-hint mb-3">
              {lang === 'UZ'
                ? 'Botda yuborilgan QR-kodni gameclubda ko\'rsating'
                : 'Покажите QR-код из бота в геймклубе'}
            </p>
            <div className="bg-tg-secondary-bg p-3 rounded-xl text-center font-mono text-xl tracking-widest">
              {booking.code}
            </div>
          </Card>
        )}

        {booking.rating && (
          <Card>
            <h3 className="font-semibold mb-2">{lang === 'UZ' ? 'Sizning bahoyingiz' : 'Ваша оценка'}</h3>
            <Stars value={booking.rating.stars} />
            {booking.rating.comment && <p className="mt-2 text-sm">{booking.rating.comment}</p>}
          </Card>
        )}

        <div className="space-y-2">
          {canRate && (
            <button onClick={() => setShowRating(true)} className="btn-primary w-full">
              <Star className="w-4 h-4 mr-2" />
              {lang === 'UZ' ? 'Baho qoldirish' : 'Оставить оценку'}
            </button>
          )}
          {canCancel && (
            <button onClick={cancel} className="btn-destructive w-full">
              {lang === 'UZ' ? 'Bekor qilish' : 'Отменить'}
            </button>
          )}
        </div>
      </div>

      {showRating && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowRating(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              {lang === 'UZ' ? 'Gameclub qanday edi?' : 'Как вам геймклуб?'}
            </h3>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    hapticImpact('light');
                    setStars(s);
                  }}
                >
                  <Star
                    className={cn(
                      'w-10 h-10',
                      s <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-tg-hint',
                    )}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={lang === 'UZ' ? 'Izoh (ixtiyoriy)...' : 'Комментарий (необязательно)...'}
              className="input min-h-[80px] resize-none mb-4"
            />
            <button onClick={submitRating} disabled={stars === 0} className="btn-primary w-full">
              {lang === 'UZ' ? 'Yuborish' : 'Отправить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value?: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-tg-hint flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className={cn('font-medium', accent && 'text-brand-600')}>{value}</span>
    </div>
  );
}
