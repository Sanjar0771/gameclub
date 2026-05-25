'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, BarChart3, Wallet, QrCode, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { Card, LoadingScreen } from '@/components/ui/common';
import { formatPrice } from '@/lib/utils';

export default function PartnerHome() {
  const { lang, user } = useAuth();

  const { data: branches, isLoading } = useQuery({
    queryKey: ['my-branches'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/partner/branches');
      return res.ok ? res.data : [];
    },
  });

  const { data: balances } = useQuery({
    queryKey: ['my-balances'],
    queryFn: async () => {
      const res = await api.get<{ total: number; branches: any[] }>('/api/partner/balances');
      return res.ok ? res.data : { total: 0, branches: [] };
    },
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 text-white px-5 pt-12 pb-8 safe-pt">
        <div className="text-sm opacity-80">{lang === 'UZ' ? 'Hamkor paneli' : 'Панель партнёра'}</div>
        <h1 className="text-2xl font-bold mt-1">{user?.firstName} {user?.lastName}</h1>
        <div className="mt-4 bg-white/20 backdrop-blur rounded-2xl p-4">
          <div className="text-xs opacity-80">{lang === 'UZ' ? 'Umumiy balans' : 'Общий баланс'}</div>
          <div className="text-2xl font-bold mt-1">
            {formatPrice(balances?.total ?? 0)} <span className="text-sm">{lang === 'UZ' ? 'so\'m' : 'сум'}</span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        <Tile href="/partner/branches" icon={<Building2 />} label={lang === 'UZ' ? 'Filiallar' : 'Филиалы'} />
        <Tile href="/partner/stats" icon={<BarChart3 />} label={lang === 'UZ' ? 'Statistika' : 'Статистика'} />
        <Tile href="/partner/balance" icon={<Wallet />} label={lang === 'UZ' ? 'Balans' : 'Баланс'} />
        <Tile href="/partner/scan" icon={<QrCode />} label={lang === 'UZ' ? 'QR skanerlash' : 'Сканировать QR'} />
      </div>

      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">{lang === 'UZ' ? 'Filiallar' : 'Филиалы'}</h2>
          <Link href="/partner/branches/new" className="text-tg-link text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            {lang === 'UZ' ? 'Yangi' : 'Новый'}
          </Link>
        </div>
        <div className="space-y-2">
          {(branches ?? []).map((b: any) => (
            <Link key={b.id} href={`/partner/branches/${b.id}`} className="block active:scale-[0.99] transition">
              <Card>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-xs text-tg-hint">{b.city} • {b.address}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {b.status}
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-tg-hint">{lang === 'UZ' ? 'PC' : 'ПК'}:</span> {b.computers?.length ?? 0}
                  </div>
                  <div>
                    <span className="text-tg-hint">{lang === 'UZ' ? 'Komissiya' : 'Комиссия'}:</span> {b.commissionPct}%
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {(branches ?? []).length === 0 && (
            <Link href="/partner/branches/new" className="block">
              <Card className="border-2 border-dashed border-tg-section-separator text-center">
                <Plus className="w-8 h-8 mx-auto text-tg-hint mb-2" />
                <div className="font-medium">{lang === 'UZ' ? 'Birinchi filialingizni qo\'shing' : 'Добавьте первый филиал'}</div>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card flex flex-col items-center gap-2 py-5 active:scale-95 transition shadow-lg">
      <div className="w-11 h-11 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
