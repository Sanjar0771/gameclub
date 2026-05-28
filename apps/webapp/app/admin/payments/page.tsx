'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, CheckCircle2, XCircle, Copy, Check, ExternalLink } from 'lucide-react';
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
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

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

  const copyCard = async (card: string) => {
    try {
      await navigator.clipboard.writeText(card.replace(/\s/g, ''));
      setCopiedCard(card);
      hapticNotification('success');
      setTimeout(() => setCopiedCard(null), 2000);
    } catch {
      await showAlert(card);
    }
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Tasdiqlash kutmoqda' : 'Ожидают подтверждения'} backHref="/admin" />

      <div className="p-4 space-y-3">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty icon={<CreditCard className="w-12 h-12" />} title={lang === 'UZ' ? 'Cheklar yo\'q' : 'Нет чеков'} />
        ) : (
          (data ?? []).map((p) => {
            const cardNum = (p.cardNumber ?? '').replace(/(\d{4})/g, '$1 ').trim();
            return (
              <Card key={p.id} className="overflow-hidden">
                {/* Header: summa va vaqt */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-xl font-bold">{formatPrice(p.amount)} <span className="text-sm font-normal text-tg-hint">{lang === 'UZ' ? 'so\'m' : 'сум'}</span></div>
                    <div className="text-sm text-tg-hint mt-0.5">{p.booking?.branch?.name}</div>
                  </div>
                  <div className="text-xs text-tg-hint">{formatDateTime(p.uploadedAt, lang)}</div>
                </div>

                {/* Karta raqami — katta ko'rinadigan, nusxa olish bilan */}
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl mb-3">
                  <div className="text-xs text-blue-600 mb-1">{lang === 'UZ' ? 'To\'lov kartasi' : 'Карта оплаты'}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-semibold tracking-wider">{cardNum || '—'}</span>
                    {cardNum && (
                      <button
                        onClick={() => copyCard(cardNum)}
                        className="p-2 rounded-lg bg-white/60 active:bg-white/90 transition"
                      >
                        {copiedCard === cardNum ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-blue-600" />
                        )}
                      </button>
                    )}
                  </div>
                  {p.cardHolderName && (
                    <div className="text-xs text-blue-500 mt-1">{p.cardHolderName}</div>
                  )}
                </div>

                {/* Mijoz va PC */}
                <div className="text-xs space-y-0.5 text-tg-hint mb-3">
                  <div>{lang === 'UZ' ? 'Mijoz' : 'Клиент'}: {p.booking?.customer?.firstName} (TG: {p.booking?.customer?.telegramId})</div>
                  <div>{lang === 'UZ' ? 'Kompyuter' : 'ПК'}: {p.booking?.computer?.name}</div>
                </div>

                {/* Chek rasmi */}
                {p.receiptImage && !p.receiptImage.startsWith('tg://') ? (
                  <div className="mb-3">
                    <div className="text-xs text-tg-hint mb-1">{lang === 'UZ' ? 'Chek rasmi (bosing kattalashtirish uchun)' : 'Скриншот чека (нажмите для увеличения)'}</div>
                    <img
                      src={p.receiptImage}
                      alt="Chek"
                      className="w-full max-h-72 object-contain rounded-xl border border-tg-section-separator cursor-pointer active:opacity-80"
                      onClick={() => setPreviewImage(p.receiptImage)}
                    />
                  </div>
                ) : p.receiptImage && p.receiptImage.startsWith('tg://') ? (
                  <div className="mb-3 p-3 bg-yellow-50 rounded-xl text-xs text-yellow-700">
                    {lang === 'UZ' ? '⚠️ Chek rasmi faqat Telegram ichida ko\'rinadi' : '⚠️ Чек виден только в Telegram'}
                  </div>
                ) : (
                  <div className="mb-3 p-3 bg-red-50 rounded-xl text-xs text-red-600">
                    {lang === 'UZ' ? '❌ Chek rasmi yo\'q' : '❌ Нет скриншота чека'}
                  </div>
                )}

                {/* Tugmalar */}
                <div className="flex gap-2">
                  <button onClick={() => confirm(p.id)} className="btn-primary flex-1 !py-2.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    {lang === 'UZ' ? 'Tasdiqlash' : 'Подтвердить'}
                  </button>
                  <button onClick={() => setRejectingId(p.id)} className="btn-destructive flex-1 !py-2.5 text-sm">
                    <XCircle className="w-4 h-4 mr-1" />
                    {lang === 'UZ' ? 'Rad etish' : 'Отклонить'}
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Rasmni katta ko'rish */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Chek" className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-6 right-6 text-white/80 text-3xl" onClick={() => setPreviewImage(null)}>&times;</button>
        </div>
      )}

      {/* Rad etish modali */}
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
