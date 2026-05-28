'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, CheckCircle2, XCircle, Wallet, Upload, Image as ImageIcon } from 'lucide-react';
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
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

  // O'tkazma cheki yuklash uchun
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completingInfo, setCompletingInfo] = useState<{ amount: number; card: string; partner: string } | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', filter],
    queryFn: async () => {
      const res = await api.get<any[]>(`/api/admin/withdrawals?status=${filter}`);
      return res.ok ? res.data : [];
    },
  });

  const startComplete = (w: any) => {
    setCompletingId(w.id);
    setCompletingInfo({
      amount: w.amount,
      card: w.cardNumber,
      partner: w.branch?.partner?.fullName ?? '—',
    });
    setReceiptPreview(null);
    setReceiptBase64(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showAlert(lang === 'UZ' ? 'Rasm 5MB dan katta' : 'Изображение больше 5МБ');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setReceiptPreview(base64);
      setReceiptBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const completeWithReceipt = async () => {
    if (!completingId) return;
    setCompleting(true);

    const res = await api.post(`/api/admin/withdrawals/${completingId}/complete`, {
      receiptBase64: receiptBase64 ?? undefined,
    });
    setCompleting(false);

    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setCompletingId(null);
      setCompletingInfo(null);
      setReceiptPreview(null);
      setReceiptBase64(null);
      await showAlert(lang === 'UZ' ? '✅ O\'tkazildi deb belgilandi' : '✅ Отмечено как переведённый');
    } else {
      await showAlert((res as any).error?.message ?? 'Xato');
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
      await navigator.clipboard.writeText(card.replace(/\s/g, ''));
      setCopiedCard(card);
      hapticNotification('success');
      setTimeout(() => setCopiedCard(null), 2000);
    } catch {
      await showAlert(card);
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Yechib olish so\'rovlari' : 'Заявки на вывод'} backHref="/admin" />

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

      <div className="p-4 space-y-3">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty icon={<Wallet className="w-12 h-12" />} title={lang === 'UZ' ? 'So\'rovlar yo\'q' : 'Нет заявок'} />
        ) : (
          (data ?? []).map((w) => {
            const cardFormatted = (w.cardNumber ?? '').replace(/(\d{4})/g, '$1 ').trim();
            return (
              <Card key={w.id}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xl font-bold text-green-600">{formatPrice(w.amount)} <span className="text-sm font-normal text-tg-hint">{lang === 'UZ' ? 'so\'m' : 'сум'}</span></div>
                    <div className="text-sm font-medium mt-0.5">{w.branch?.name}</div>
                  </div>
                  <Badge variant={w.status === 'COMPLETED' ? 'success' : w.status === 'REJECTED' ? 'danger' : 'warning'}>
                    {w.status}
                  </Badge>
                </div>

                {/* Hamkor ma'lumotlari */}
                <div className="text-xs text-tg-hint space-y-0.5 mb-2">
                  <div>{lang === 'UZ' ? 'Hamkor' : 'Партнёр'}: {w.branch?.partner?.fullName}</div>
                  <div>{lang === 'UZ' ? 'Tel' : 'Тел'}: {w.branch?.partner?.phone}</div>
                </div>

                {/* Karta raqami — katta va aniq */}
                <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl mb-2">
                  <div className="text-xs text-green-600 mb-1">{lang === 'UZ' ? 'O\'tkazish kartasi' : 'Карта для перевода'}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-semibold tracking-wider">{cardFormatted}</span>
                    <button
                      onClick={() => copyCard(cardFormatted)}
                      className="p-2 rounded-lg bg-white/60 active:bg-white/90 transition"
                    >
                      {copiedCard === cardFormatted ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-green-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-tg-hint mb-2">{formatDateTime(w.createdAt, lang)}</div>

                {/* Agar chek yuklangan bo'lsa (bajarilganlar uchun) */}
                {w.receiptImage && !w.receiptImage.startsWith('tg://') && (
                  <div className="mb-2">
                    <div className="text-xs text-tg-hint mb-1">{lang === 'UZ' ? 'O\'tkazma cheki' : 'Чек перевода'}</div>
                    <img src={w.receiptImage} alt="Receipt" className="w-full max-h-48 object-contain rounded-xl border border-tg-section-separator" />
                  </div>
                )}

                {w.rejectReason && (
                  <div className="text-xs text-red-600 mb-2">{lang === 'UZ' ? 'Sabab' : 'Причина'}: {w.rejectReason}</div>
                )}

                {w.status === 'REQUESTED' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => startComplete(w)} className="btn-primary flex-1 !py-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      {lang === 'UZ' ? 'O\'tkazildi' : 'Переведено'}
                    </button>
                    <button onClick={() => setRejectingId(w.id)} className="btn-destructive flex-1 !py-2.5 text-sm">
                      {lang === 'UZ' ? 'Rad etish' : 'Отклонить'}
                    </button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* O'tkazma tasdiqlash modali — chek yuklash bilan */}
      {completingId && completingInfo && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => { setCompletingId(null); setCompletingInfo(null); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">
              {lang === 'UZ' ? 'Pul o\'tkazilganini tasdiqlang' : 'Подтвердите перевод'}
            </h3>
            <div className="text-sm text-tg-hint mb-4">
              {lang === 'UZ'
                ? `${formatPrice(completingInfo.amount)} so'm → ${completingInfo.partner}`
                : `${formatPrice(completingInfo.amount)} сум → ${completingInfo.partner}`}
            </div>

            {/* Karta raqami */}
            <div className="p-3 bg-green-50 rounded-xl mb-4">
              <div className="text-xs text-green-600 mb-1">{lang === 'UZ' ? 'Karta' : 'Карта'}</div>
              <div className="font-mono text-lg font-semibold tracking-wider">
                {completingInfo.card.replace(/(\d{4})/g, '$1 ').trim()}
              </div>
            </div>

            {/* Chek rasmi yuklash */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">
                {lang === 'UZ' ? 'O\'tkazma cheki (ixtiyoriy)' : 'Чек перевода (необязательно)'}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {receiptPreview ? (
                <div className="relative">
                  <img src={receiptPreview} alt="Preview" className="w-full max-h-48 object-contain rounded-xl border border-tg-section-separator" />
                  <button
                    onClick={() => { setReceiptPreview(null); setReceiptBase64(null); }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-tg-section-separator rounded-xl flex flex-col items-center gap-2 text-tg-hint active:bg-tg-secondary-bg"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">{lang === 'UZ' ? 'Chek rasmini yuklang' : 'Загрузите скриншот чека'}</span>
                </button>
              )}
              <p className="text-xs text-tg-hint mt-1">
                {lang === 'UZ'
                  ? 'Chek hamkorga yuboriladi. Yuklamasangiz ham bo\'ladi.'
                  : 'Чек будет отправлен партнёру. Можно не загружать.'}
              </p>
            </div>

            <button
              onClick={completeWithReceipt}
              disabled={completing}
              className="btn-primary w-full"
            >
              {completing ? '...' : lang === 'UZ' ? '✅ Tasdiqlash' : '✅ Подтвердить'}
            </button>
          </div>
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
