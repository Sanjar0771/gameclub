'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, CheckCircle2, XCircle, ImageIcon, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen } from '@/components/ui/common';
import { formatDateTime, formatPrice } from '@/lib/utils';
import { hapticNotification, showAlert, showConfirm } from '@/lib/telegram';

export default function PendingPayments() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/admin/payments/pending');
      return res.ok ? res.data : [];
    },
  });

  const confirm = async (id: string) => {
    const ok = await showConfirm(lang === 'UZ' ? 'To\'lovni tasdiqlaymizmi?' : 'Подтвердить оплату?');
    if (!ok) return;
    const res = await api.post(`/api/admin/payments/${id}/confirm`);
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['pending-payments'] });
      await showAlert(lang === 'UZ' ? 'Tasdiqlandi, QR yuborildi' : 'Подтверждено, QR отправлен');
    } else {
      await showAlert((res as any).error.message);
    }
  };

  const reject = async () => {
    if (!rejectingId || !reason) return;
    const res = await api.post(`/api/admin/payments/${rejectingId}/reject`, { reason });
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['pending-payments'] });
      setRejectingId(null);
      setReason('');
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Tasdiqlash kutmoqda' : 'Ожидают подтверждения'} backHref="/admin" />

      <div className="p-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty icon={<CreditCard className="w-12 h-12" />} title={lang === 'UZ' ? 'Cheklar yo\'q' : 'Нет чеков'} />
        ) : (
          (data ?? []).map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{formatPrice(p.amount)} {lang === 'UZ' ? 'so\'m' : 'сум'}</div>
                  <div className="text-xs text-tg-hint">{p.booking?.branch?.name}</div>
                </div>
                <div className="text-xs text-tg-hint">{formatDateTime(p.uploadedAt, lang)}</div>
              </div>
              <div className="text-xs space-y-0.5 text-tg-hint">
                <div>{lang === 'UZ' ? 'Mijoz' : 'Клиент'}: {p.booking?.customer?.firstName} (TG: {p.booking?.customer?.telegramId})</div>
                <div>{lang === 'UZ' ? 'Karta' : 'Карта'}: {p.cardNumber}</div>
                <div>{lang === 'UZ' ? 'PC' : 'ПК'}: {p.booking?.computer?.name}</div>
              </div>
              {p.receiptImage && !p.receiptImage.startsWith('tg://') && (
                <div className="mt-2">
                  <img
                    src={p.receiptImage}
                    alt="Chek"
                    className="w-full max-h-64 object-contain rounded-lg border border-tg-section-separator"
                    onClick={() => window.open(p.receiptImage, '_blank')}
                  />
                </div>
              )}
              {p.receiptImage && p.receiptImage.startsWith('tg://') && (
                <div className="mt-2 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                  {lang === 'UZ' ? '⚠️ Chek rasmi faqat Telegram ichida ko\'rinadi' : '⚠️ Чек виден только в Telegram'}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => confirm(p.id)} className="btn-primary flex-1 !py-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  {lang === 'UZ' ? 'Tasdiqlash' : 'Подтвердить'}
                </button>
                <button onClick={() => setRejectingId(p.id)} className="btn-destructive flex-1 !py-2 text-sm">
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
              placeholder={lang === 'UZ' ? 'Masalan: noto\'g\'ri summa' : 'Например: неверная сумма'}
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
