'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { QrCode, ListChecks, Monitor, Wallet, Tag, AlertCircle, Headphones } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { Card, LoadingScreen, Badge } from '@/components/ui/common';

interface AssistantData {
  branch: any;
  permissions: Record<string, boolean>;
}

export default function AssistantHome() {
  const { lang, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['assistant-branch'],
    queryFn: async () => {
      const res = await api.get<AssistantData>('/api/assistant/branch');
      return res.ok ? res.data : null;
    },
  });

  if (isLoading) return <LoadingScreen />;

  if (!data?.branch) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Headphones className="w-12 h-12 text-tg-hint mb-4" />
        <h2 className="text-lg font-semibold">{lang === 'UZ' ? 'Filial topilmadi' : 'Филиал не найден'}</h2>
        <p className="text-sm text-tg-hint mt-2">
          {lang === 'UZ'
            ? 'Hamkordan sizni yordamchi qilib qo\'shishini so\'rang'
            : 'Попросите партнёра добавить вас помощником'}
        </p>
      </div>
    );
  }

  const p = data.permissions;
  const tiles = [
    { perm: p.canViewBookings, href: '/assistant/bookings', icon: <ListChecks />, label: lang === 'UZ' ? 'Bronlar' : 'Брони' },
    { perm: p.canConfirmQr, href: '/partner/scan', icon: <QrCode />, label: lang === 'UZ' ? 'QR skan' : 'QR-скан' },
    { perm: p.canManageComputers, href: '/assistant/computers', icon: <Monitor />, label: lang === 'UZ' ? 'PClar' : 'ПК' },
    { perm: p.canViewIncome, href: '/assistant/income', icon: <Wallet />, label: lang === 'UZ' ? 'Daromad' : 'Доход' },
    { perm: p.canManagePromotions, href: '/assistant/promotions', icon: <Tag />, label: lang === 'UZ' ? 'Aksiyalar' : 'Акции' },
    { perm: p.canViewComplaints, href: '/assistant/complaints', icon: <AlertCircle />, label: lang === 'UZ' ? 'Shikoyatlar' : 'Жалобы' },
  ].filter((t) => t.perm);

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white px-5 pt-12 pb-8 safe-pt">
        <div className="text-sm opacity-80">{lang === 'UZ' ? 'Yordamchi paneli' : 'Панель помощника'}</div>
        <h1 className="text-2xl font-bold mt-1">{data.branch.name}</h1>
        <div className="text-sm opacity-80 mt-1">{data.branch.address}</div>
        <Badge variant={data.branch.status === 'ACTIVE' ? 'success' : 'warning'}>{data.branch.status}</Badge>
      </div>

      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        {tiles.map((t, i) => (
          <Link
            key={i}
            href={t.href}
            className="card flex flex-col items-center gap-2 py-5 active:scale-95 transition shadow-lg"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              {t.icon}
            </div>
            <span className="text-sm font-medium text-center">{t.label}</span>
          </Link>
        ))}
      </div>

      {tiles.length === 0 && (
        <Card className="mx-4 mt-4">
          <p className="text-center text-tg-hint text-sm">
            {lang === 'UZ'
              ? 'Hamkor sizga hech qanday ruxsat bermagan. Hamkorga murojaat qiling.'
              : 'Партнёр не дал вам никаких прав. Обратитесь к партнёру.'}
          </p>
        </Card>
      )}
    </div>
  );
}
