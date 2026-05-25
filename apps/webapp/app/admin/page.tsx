'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Building2,
  CalendarCheck,
  TrendingUp,
  CreditCard,
  Wallet,
  AlertCircle,
  MessageSquare,
  Shield,
  Settings,
  ScrollText,
  LineChart as LineIcon,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { Card, LoadingScreen } from '@/components/ui/common';
import { formatPrice } from '@/lib/utils';

export default function AdminDashboard() {
  const { lang, user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get<any>('/api/admin/stats');
      return res.ok ? res.data : null;
    },
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <div className="bg-gradient-to-br from-purple-600 to-purple-900 text-white px-5 pt-12 pb-8 safe-pt">
        <div className="text-sm opacity-80">
          {isSuper ? (lang === 'UZ' ? 'Super-admin' : 'Супер-админ') : (lang === 'UZ' ? 'Pre-admin' : 'Пре-админ')}
        </div>
        <h1 className="text-2xl font-bold mt-1">{user?.firstName}</h1>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-white/20 backdrop-blur rounded-xl p-3">
            <div className="text-xs opacity-80">{lang === 'UZ' ? 'Mijozlar' : 'Клиентов'}</div>
            <div className="text-xl font-bold mt-1">{data?.totals?.customers ?? 0}</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3">
            <div className="text-xs opacity-80">{lang === 'UZ' ? 'Hamkorlar' : 'Партнёров'}</div>
            <div className="text-xl font-bold mt-1">{data?.totals?.partners ?? 0}</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3">
            <div className="text-xs opacity-80">{lang === 'UZ' ? 'Filiallar' : 'Филиалов'}</div>
            <div className="text-xl font-bold mt-1">{data?.totals?.branches ?? 0}</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3">
            <div className="text-xs opacity-80">{lang === 'UZ' ? 'Bronlar' : 'Броней'}</div>
            <div className="text-xl font-bold mt-1">{data?.totals?.bookings ?? 0}</div>
          </div>
        </div>

        {isSuper && data?.totals?.commission !== null && (
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 mt-2">
            <div className="text-xs opacity-80">{lang === 'UZ' ? 'Komissiya daromadi' : 'Доход с комиссии'}</div>
            <div className="text-2xl font-bold mt-1">{formatPrice(data.totals.commission)} {lang === 'UZ' ? 'so\'m' : 'сум'}</div>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {isSuper && data?.byDay && data.byDay.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <LineIcon className="w-4 h-4" />
              {lang === 'UZ' ? 'Kunlik komissiya' : 'Дневная комиссия'}
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tg-section-separator)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip
                    formatter={(v: any) => formatPrice(v) + ' ' + (lang === 'UZ' ? 'so\'m' : 'сум')}
                    contentStyle={{ background: 'var(--tg-section-bg)', border: '1px solid var(--tg-section-separator)', borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="commission" stroke="#a855f7" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <h2 className="text-base font-semibold pt-2">{lang === 'UZ' ? 'Boshqaruv' : 'Управление'}</h2>
        <div className="grid grid-cols-3 gap-2">
          <Tile href="/admin/pending" icon={<Users />} label={lang === 'UZ' ? 'Arizalar' : 'Заявки'} color="bg-blue-500" />
          <Tile href="/admin/partners" icon={<Building2 />} label={lang === 'UZ' ? 'Hamkorlar' : 'Партнёры'} color="bg-green-500" />
          <Tile href="/admin/complaints" icon={<MessageSquare />} label={lang === 'UZ' ? 'Shikoyatlar' : 'Жалобы'} color="bg-orange-500" />
          {isSuper && (
            <>
              <Tile href="/admin/payments" icon={<CreditCard />} label={lang === 'UZ' ? 'To\'lovlar' : 'Платежи'} color="bg-pink-500" />
              <Tile href="/admin/withdrawals" icon={<Wallet />} label={lang === 'UZ' ? 'Yechishlar' : 'Выводы'} color="bg-teal-500" />
              <Tile href="/admin/pre-admins" icon={<Shield />} label={lang === 'UZ' ? 'Pre-adminlar' : 'Пре-админы'} color="bg-indigo-500" />
              <Tile href="/admin/bot-texts" icon={<Settings />} label={lang === 'UZ' ? 'Bot matnlari' : 'Тексты бота'} color="bg-gray-500" />
              <Tile href="/admin/broadcast" icon={<TrendingUp />} label={lang === 'UZ' ? 'Yuborish' : 'Рассылка'} color="bg-red-500" />
              <Tile href="/admin/audit-logs" icon={<ScrollText />} label={lang === 'UZ' ? 'Audit' : 'Аудит'} color="bg-yellow-500" />
            </>
          )}
        </div>

        {data?.topBranches && data.topBranches.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-2">{lang === 'UZ' ? 'Top filiallar' : 'Топ филиалов'}</h3>
            <div className="space-y-2">
              {data.topBranches.slice(0, 5).map((b: any, i: number) => (
                <div key={b.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-tg-hint w-5">#{i + 1}</span>
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-tg-hint">{b.city}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{b.bookings}</div>
                    <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'bron' : 'броней'}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Tile({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center gap-2 py-4 active:scale-95 transition shadow-sm"
    >
      <div className={`w-10 h-10 rounded-xl ${color} text-white flex items-center justify-center`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-center">{label}</span>
    </Link>
  );
}
