'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen } from '@/components/ui/common';
import { formatPrice } from '@/lib/utils';
import { hapticImpact, hapticNotification, showAlert } from '@/lib/telegram';

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: bookings } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/customer/bookings');
      return res.ok ? res.data : [];
    },
  });

  const booking = bookings?.find((b) => b.id === id);
  if (!booking) return <LoadingScreen />;

  const cardNumber = booking.payment?.cardNumber ?? '';
  const formattedCard = cardNumber.replace(/(\d{4})/g, '$1 ').trim();

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(cardNumber);
      setCopied(true);
      hapticNotification('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await showAlert(lang === 'UZ' ? 'Karta raqami: ' + cardNumber : 'Карта: ' + cardNumber);
    }
  };

  const openBot = () => {
    hapticImpact('medium');
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.close) tg.close();
    else window.history.back();
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'To\'lov' : 'Оплата'} backHref="/customer/bookings" />

      <div className="px-4 py-4 space-y-4">
        <Card>
          <div className="text-center mb-4">
            <div className="text-sm text-tg-hint mb-1">
              {lang === 'UZ' ? 'To\'lash kerak' : 'К оплате'}
            </div>
            <div className="text-3xl font-bold text-brand-600">
              {formatPrice(booking.totalAmount)} <span className="text-lg">{lang === 'UZ' ? 'so\'m' : 'сум'}</span>
            </div>
          </div>

          <div className="text-sm text-tg-hint mb-2">
            {lang === 'UZ' ? 'Karta raqami' : 'Номер карты'}
          </div>
          <button
            onClick={copyCard}
            className="w-full flex items-center justify-between bg-tg-secondary-bg p-3 rounded-xl active:scale-[0.99]"
          >
            <span className="font-mono text-lg tracking-wider">{formattedCard || '****'}</span>
            {copied ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <Copy className="w-5 h-5 text-tg-hint" />
            )}
          </button>
          <div className="text-xs text-tg-hint text-center mt-2">
            {lang === 'UZ' ? 'Bosing va karta raqamini nusxa oling' : 'Нажмите, чтобы скопировать номер'}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">
            {lang === 'UZ' ? '📋 Ko\'rsatmalar' : '📋 Инструкции'}
          </h3>
          <ol className="space-y-3 text-sm">
            <Step n={1}>
              {lang === 'UZ'
                ? 'Yuqoridagi karta raqamiga summa o\'tkazing'
                : 'Переведите сумму на карту выше'}
            </Step>
            <Step n={2}>
              {lang === 'UZ'
                ? 'To\'lov chekining screenshot rasmini oling'
                : 'Сделайте скриншот чека оплаты'}
            </Step>
            <Step n={3}>
              {lang === 'UZ'
                ? 'Telegram bot chatiga screenshot rasmni yuboring'
                : 'Отправьте скриншот в чат с Telegram-ботом'}
            </Step>
            <Step n={4}>
              {lang === 'UZ'
                ? 'Tasdiqdan keyin QR-kod yuboriladi'
                : 'После проверки придёт QR-код'}
            </Step>
          </ol>
        </Card>

        <button onClick={openBot} className="btn-primary w-full flex items-center justify-center gap-2">
          <MessageCircle className="w-5 h-5" />
          {lang === 'UZ' ? 'Botga chekni yuborish' : 'Отправить чек боту'}
        </button>

        <div className="text-xs text-tg-hint text-center">
          {lang === 'UZ'
            ? 'Bron 1 soat ichida to\'lanmasa avtomatik bekor qilinadi'
            : 'Бронь автоматически отменится, если не оплатить в течение 1 часа'}
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
