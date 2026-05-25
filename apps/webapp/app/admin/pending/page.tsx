'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, User } from 'lucide-react';
import { api, loginWithTelegram, getAuthToken } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen } from '@/components/ui/common';
import { formatDateTime } from '@/lib/utils';
import { hapticNotification, showAlert, showConfirm } from '@/lib/telegram';

export default function PendingApplications() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-partners'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/admin/partners/pending');
      return res.ok ? res.data : [];
    },
  });

  const approve = async (id: string) => {
    const ok = await showConfirm(lang === 'UZ' ? 'Tasdiqlaymizmi?' : 'Одобрить?');
    if (!ok) return;
    try {
      let res = await api.post(`/api/admin/partners/${id}/approve`);

      // Agar auth xato bo'lsa — tokenni yangilab qayta urinish
      if (!res.ok && ((res as any).error?.code === 'UNAUTHORIZED' || (res as any).error?.code === 'NETWORK')) {
        const loginRes = await loginWithTelegram();
        if (loginRes.ok) {
          res = await api.post(`/api/admin/partners/${id}/approve`);
        }
      }

      if (res.ok) {
        hapticNotification('success');
        qc.invalidateQueries({ queryKey: ['pending-partners'] });
        await showAlert(lang === 'UZ' ? '✅ Tasdiqlandi!' : '✅ Одобрено!');
      } else {
        hapticNotification('error');
        const errMsg = (res as any).error?.message || (res as any).error?.code || 'Noma\'lum xato';
        await showAlert(lang === 'UZ' ? `Xato: ${errMsg}` : `Ошибка: ${errMsg}`);
      }
    } catch (e: any) {
      hapticNotification('error');
      await showAlert(lang === 'UZ' ? `Xato: ${e?.message || e}` : `Ошибка: ${e?.message || e}`);
    }
  };

  const reject = async () => {
    if (!rejectingId || !reason) return;
    try {
      let res = await api.post(`/api/admin/partners/${rejectingId}/reject`, { reason });

      // Auth xato — tokenni yangilab qayta urinish
      if (!res.ok && ((res as any).error?.code === 'UNAUTHORIZED' || (res as any).error?.code === 'NETWORK')) {
        const loginRes = await loginWithTelegram();
        if (loginRes.ok) {
          res = await api.post(`/api/admin/partners/${rejectingId}/reject`, { reason });
        }
      }

      if (res.ok) {
        hapticNotification('success');
        qc.invalidateQueries({ queryKey: ['pending-partners'] });
        setRejectingId(null);
        setReason('');
      } else {
        const errMsg = (res as any).error?.message || 'Noma\'lum xato';
        await showAlert(lang === 'UZ' ? `Xato: ${errMsg}` : `Ошибка: ${errMsg}`);
      }
    } catch (e: any) {
      await showAlert(lang === 'UZ' ? `Xato: ${e?.message || e}` : `Ошибка: ${e?.message || e}`);
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Kutilayotgan arizalar' : 'Ожидающие заявки'} backHref="/admin" />

      <div className="p-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty
            icon={<User className="w-12 h-12" />}
            title={lang === 'UZ' ? 'Arizalar yo\'q' : 'Заявок нет'}
          />
        ) : (
          (data ?? []).map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold">{p.fullName}</div>
                  <div className="text-sm text-tg-hint">{p.phone}</div>
                </div>
                <div className="text-xs text-tg-hint">{formatDateTime(p.createdAt, lang)}</div>
              </div>
              <div className="text-xs text-tg-hint mb-3">
                Telegram: @{p.user?.username ?? '—'} • ID: {p.user?.telegramId}
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve(p.id)} className="btn-primary flex-1 !py-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  {lang === 'UZ' ? 'Tasdiqlash' : 'Одобрить'}
                </button>
                <button
                  onClick={() => setRejectingId(p.id)}
                  className="btn-destructive flex-1 !py-2 text-sm"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  {lang === 'UZ' ? 'Rad etish' : 'Отклонить'}
                </button>
              </div>
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
              placeholder={lang === 'UZ' ? 'Sababni yozing...' : 'Напишите причину...'}
            />
            <button onClick={reject} disabled={!reason} className="btn-destructive w-full">
              {lang === 'UZ' ? 'Rad etish' : 'Отклонить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
