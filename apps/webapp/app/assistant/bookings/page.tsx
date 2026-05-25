'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen, Badge, Empty } from '@/components/ui/common';
import { formatDateTime, formatPrice, cn } from '@/lib/utils';
import { hapticNotification, showConfirm, showAlert } from '@/lib/telegram';

export default function AssistantBookings() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('');
  const [perms, setPerms] = useState<any>({});

  useState(() => {
    api.get<any>('/api/assistant/branch').then((res) => {
      if (res.ok) setPerms(res.data.permissions);
    });
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['assistant-bookings', filter],
    queryFn: async () => {
      const url = filter ? `/api/assistant/bookings?status=${filter}` : '/api/assistant/bookings';
      const res = await api.get<any[]>(url);
      return res.ok ? res.data : [];
    },
  });

  const reject = async (id: string) => {
    const ok = await showConfirm(lang === 'UZ' ? 'Bronni rad etish?' : 'Отклонить бронь?');
    if (!ok) return;
    const res = await api.post(`/api/assistant/bookings/${id}/reject`, {});
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['assistant-bookings'] });
    } else {
      await showAlert((res as any).error.message);
    }
  };

  const markNoShow = async (id: string) => {
    const ok = await showConfirm(lang === 'UZ' ? 'Kelmagan deb belgilash?' : 'Отметить как не пришедший?');
    if (!ok) return;
    const res = await api.post(`/api/assistant/bookings/${id}/no-show`, {});
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['assistant-bookings'] });
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Bronlar' : 'Брони'} />

      <div className="p-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { v: '', l: lang === 'UZ' ? 'Hammasi' : 'Все' },
            { v: 'CONFIRMED', l: lang === 'UZ' ? 'Tasdiqlangan' : 'Подтв.' },
            { v: 'ACTIVE', l: lang === 'UZ' ? 'Faol' : 'Активн.' },
            { v: 'COMPLETED', l: lang === 'UZ' ? 'Tugagan' : 'Заверш.' },
            { v: 'NO_SHOW', l: lang === 'UZ' ? 'Kelmagan' : 'Не приш.' },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm whitespace-nowrap',
                filter === f.v ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
              )}
            >
              {f.l}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingScreen />
        ) : (bookings ?? []).length === 0 ? (
          <Empty title={lang === 'UZ' ? 'Bronlar yo\'q' : 'Нет броней'} />
        ) : (
          <div className="space-y-2">
            {(bookings ?? []).map((b: any) => (
              <Card key={b.id} className="!p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">#{b.code}</div>
                    <div className="text-xs text-tg-hint">{b.customer?.firstName ?? 'Mijoz'}</div>
                  </div>
                  <Badge>{b.status}</Badge>
                </div>
                <div className="text-sm space-y-0.5">
                  <div className="text-tg-hint text-xs">
                    {b.computer?.name} • {b.computer?.type?.name}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(b.startAt, lang)} ({b.durationMinutes / 60}{lang === 'UZ' ? 's' : 'ч'})
                  </div>
                  <div className="font-semibold">{formatPrice(b.partnerAmount)} {lang === 'UZ' ? 'so\'m' : 'сум'}</div>
                </div>
                {b.status === 'CONFIRMED' && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-tg-section-separator">
                    {perms.canRejectBooking && (
                      <button onClick={() => reject(b.id)} className="flex-1 text-xs py-1.5 bg-red-100 text-red-700 rounded-lg">
                        {lang === 'UZ' ? 'Rad etish' : 'Отклонить'}
                      </button>
                    )}
                    {perms.canMarkNoShow && (
                      <button onClick={() => markNoShow(b.id)} className="flex-1 text-xs py-1.5 bg-orange-100 text-orange-700 rounded-lg">
                        {lang === 'UZ' ? 'Kelmagan' : 'Не пришёл'}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
