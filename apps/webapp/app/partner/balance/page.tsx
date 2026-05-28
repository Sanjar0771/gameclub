'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, ArrowDownToLine, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen, Badge } from '@/components/ui/common';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { hapticNotification, showAlert } from '@/lib/telegram';

export default function PartnerBalance() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [showRequest, setShowRequest] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);

  const { data: balances, isLoading } = useQuery({
    queryKey: ['my-balances'],
    queryFn: async () => {
      const res = await api.get<any>('/api/partner/balances');
      return res.ok ? res.data : null;
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ['my-withdrawals'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/partner/withdrawals');
      return res.ok ? res.data : [];
    },
  });

  const requestWithdrawal = async () => {
    if (!showRequest || !amount) return;
    if (amount < 50000) {
      await showAlert(lang === 'UZ' ? 'Minimal 50,000 so\'m' : 'Минимум 50,000 сум');
      return;
    }
    setSubmitting(true);
    const res = await api.post('/api/partner/withdrawals', { branchId: showRequest, amount });
    setSubmitting(false);
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['my-balances'] });
      qc.invalidateQueries({ queryKey: ['my-withdrawals'] });
      setShowRequest(null);
      setAmount(0);
      await showAlert(lang === 'UZ' ? 'So\'rov yuborildi' : 'Запрос отправлен');
    } else {
      await showAlert((res as any).error.message);
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Balans' : 'Баланс'} />

      <div className="p-4 space-y-4">
        <Card className="!bg-gradient-to-br !from-brand-500 !to-brand-700 text-white">
          <div className="flex items-center gap-2 text-sm opacity-80 mb-1">
            <Wallet className="w-4 h-4" />
            {lang === 'UZ' ? 'Umumiy balans' : 'Общий баланс'}
          </div>
          <div className="text-3xl font-bold">{formatPrice(balances?.total ?? 0)}</div>
          <div className="text-sm opacity-80 mt-1">{lang === 'UZ' ? 'so\'m' : 'сум'}</div>
        </Card>

        <h2 className="text-base font-semibold pt-2">{lang === 'UZ' ? 'Filiallar' : 'Филиалы'}</h2>
        <div className="space-y-2">
          {(balances?.branches ?? []).map((b: any) => (
            <Card key={b.branchId} className="!p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{b.branchName}</div>
                  <div className="text-xs text-tg-hint mt-1">
                    {lang === 'UZ' ? 'Jami daromad' : 'Всего заработано'}: {formatPrice(b.totalEarned)}
                  </div>
                  <div className="text-xs text-tg-hint">
                    {lang === 'UZ' ? 'Yechib olingan' : 'Выведено'}: {formatPrice(b.totalWithdrawn)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-600">{formatPrice(b.balance)}</div>
                  <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'mavjud' : 'доступно'}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRequest(b.branchId);
                  setAmount(b.balance);
                }}
                disabled={b.balance < 50000}
                className="btn-primary w-full !py-2 text-sm"
              >
                <ArrowDownToLine className="w-4 h-4 mr-1" />
                {lang === 'UZ' ? 'Yechib olish' : 'Вывести'}
              </button>
            </Card>
          ))}
        </div>

        <h2 className="text-base font-semibold pt-3">{lang === 'UZ' ? 'Tarix' : 'История'}</h2>
        <div className="space-y-2">
          {(withdrawals ?? []).map((w) => (
            <Card key={w.id} className="!p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{formatPrice(w.amount)} {lang === 'UZ' ? 'so\'m' : 'сум'}</div>
                  <div className="text-xs text-tg-hint flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(w.createdAt, lang)}
                  </div>
                </div>
                <Badge variant={w.status === 'COMPLETED' ? 'success' : w.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {w.status}
                </Badge>
              </div>
              {w.status === 'COMPLETED' && w.receiptImage && !w.receiptImage.startsWith('tg://') && (
                <div className="mt-2">
                  <div className="text-xs text-tg-hint mb-1">{lang === 'UZ' ? 'O\'tkazma cheki' : 'Чек перевода'}</div>
                  <img
                    src={w.receiptImage}
                    alt="Receipt"
                    onClick={() => setFullImage(w.receiptImage)}
                    className="w-full max-h-40 object-contain rounded-xl border border-tg-section-separator cursor-pointer active:opacity-80"
                  />
                  <div className="text-xs text-brand-500 text-center mt-1">{lang === 'UZ' ? 'Kattalashtirish uchun bosing' : 'Нажмите для увеличения'}</div>
                </div>
              )}
              {w.rejectReason && (
                <div className="text-xs text-red-600 mt-2">{w.rejectReason}</div>
              )}
            </Card>
          ))}
          {(withdrawals ?? []).length === 0 && (
            <div className="text-center text-tg-hint text-sm py-6">
              {lang === 'UZ' ? 'Yechib olishlar yo\'q' : 'Выводов нет'}
            </div>
          )}
        </div>
      </div>

      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowRequest(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Yechib olish so\'rovi' : 'Запрос на вывод'}</h3>
            <p className="text-sm text-tg-hint mb-3">
              {lang === 'UZ'
                ? 'Pul filialingiz karta raqamiga 1-2 ish kuni ichida o\'tkaziladi'
                : 'Деньги поступят на карту филиала в течение 1-2 рабочих дней'}
            </p>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input mb-3"
              placeholder={lang === 'UZ' ? 'Summa' : 'Сумма'}
            />
            <p className="text-xs text-tg-hint mb-3">
              {lang === 'UZ' ? 'Minimal' : 'Минимум'}: 50,000 {lang === 'UZ' ? 'so\'m' : 'сум'}
            </p>
            <button onClick={requestWithdrawal} disabled={submitting} className="btn-primary w-full">
              {submitting ? '...' : lang === 'UZ' ? 'So\'rov yuborish' : 'Отправить запрос'}
            </button>
          </div>
        </div>
      )}

      {fullImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setFullImage(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl font-bold z-10" onClick={() => setFullImage(null)}>&times;</button>
          <img src={fullImage} alt="Receipt" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
