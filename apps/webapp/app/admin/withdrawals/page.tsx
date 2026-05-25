'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, CheckCircle2, XCircle, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Badge } from '@/components/ui/common';
import { formatDateTime, formatPrice, cn } from '@/lib/utils';
import { hapticNotification, showAlert, showConfirm } from '@/lib/telegram';

export default function AdminWithdrawals() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('REQUESTED');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', filter],
    queryFn: async () => {
      const res = await api.get<any[]>(`/api/admin/withdrawals?status=${filter}`);
      return res.ok ? res.data : [];
    },
  });

  const complete = async (id: string) => {
    const ok = await showConfirm(
      lang === 'UZ' ? 'Pul o\'tkazildi deb belgilaymizmi?' : 'Отметить как переведённый?',
    );
    if (!ok) return;
    const res = await api.post(`/api/admin/withdrawals/${id}/complete`);
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    }
  };

  const reject = async () => {
    if (!rejectingId || !reason) return;
    const res = await api.post(`/api/admin/withdrawals/${rejectingId}/reject`, { reason });
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setRejectingId(null);
      setReason('');
    }
  };

  const copyCard = async (card: string) => {
    try {
      await navigator.clipboard.writeText(card);
      hapticNotification('success');
      await showAlert(lang === 'UZ' ? 'Nusxa olindi' : 'Скопировано');
    } catch {
      await showAlert(card);
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Yechib olish so\'rovlari' : 'Заявки на вывод'} />

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        {[
          { v: 'REQUESTED', l: lang === 'UZ' ? 'Kutmoqda' : 'Ожидает' },
          { v: 'COMPLETED', l: lang === 'UZ' ? 'Bajarildi' : 'Выполнено' },
          { v: 'REJECTED', l: lang === 'UZ' ? 'Rad etilgan' : 'Отклонено' },
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

      <div className="p-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty icon={<Wallet className="w-12 h-12" />} title={lang === 'UZ' ? 'So\'rovlar yo\'q' : 'Нет заявок'} />
        ) : (
          (data ?? []).map((w) => (
            <Card key={w.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-xl font-bold text-green-600">{formatPrice(w.amount)} {lang === 'UZ' ? 'so\'m' : 'сум'}</div>
                  <div className="text-sm font-medium mt-0.5">{w.branch?.name}</div>
                </div>
                <Badge variant={w.status === 'COMPLETED' ? 'success' : w.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {w.status}
                </Badge>
              </div>
              <div className="text-xs text-tg-hint space-y-0.5">
                <div>{lang === 'UZ' ? 'Hamkor' : 'Партнёр'}: {w.branch?.partner?.fullName}</div>
                <div>{lang === 'UZ' ? 'Tel' : 'Тел'}: {w.branch?.partner?.phone}</div>
              </div>
              <div className="mt-2 p-2 bg-tg-secondary-bg rounded-xl flex items-center justify-between">
                <span className="font-mono text-sm">{w.cardNumber}</span>
                <button onClick={() => copyCard(w.cardNumber)} className="text-tg-link">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-tg-hint mt-1">{formatDateTime(w.createdAt, lang)}</div>
              {w.rejectReason && (
                <div className="text-xs text-red-600 mt-1">{lang === 'UZ' ? 'Sabab' : 'Причина'}: {w.rejectReason}</div>
              )}
              {w.status === 'REQUESTED' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => complete(w.id)} className="btn-primary flex-1 !py-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    {lang === 'UZ' ? 'O\'tkazildi' : 'Переведено'}
                  </button>
                  <button onClick={() => setRejectingId(w.id)} className="btn-destructive flex-1 !py-2 text-sm">
                    {lang === 'UZ' ? 'Rad etish' : 'Отклонить'}
                  </button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setRejectingId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Rad etish sababi' : 'Причина отказа'}</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input min-h-[100px] mb-3"
            />
            <button onClick={reject} disabled={!reason} className="btn-destructive w-full">
              {lang === 'UZ' ? 'Rad etish (pul qaytariladi)' : 'Отклонить (деньги вернутся)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
