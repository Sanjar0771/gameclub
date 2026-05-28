'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, BarChart3, Wallet, QrCode, Plus, Clock, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { Card, LoadingScreen } from '@/components/ui/common';
import { formatPrice } from '@/lib/utils';

export default function PartnerHome() {
  const { lang, user } = useAuth();
  const partnerStatus = user?.partner?.status;
  const isApproved = partnerStatus === 'APPROVED';

  const { data: branches, isLoading } = useQuery({
    queryKey: ['my-branches'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/partner/branches');
      if (!res.ok) throw new Error(res.error?.message || 'API xato');
      return res.data;
    },
    enabled: isApproved,
  });

  const { data: balances } = useQuery({
    queryKey: ['my-balances'],
    queryFn: async () => {
      const res = await api.get<{ total: number; branches: any[] }>('/api/partner/balances');
      return res.ok ? res.data : { total: 0, branches: [] };
    },
    enabled: isApproved,
  });

  if (isLoading && isApproved) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 text-white px-5 pt-12 pb-8 safe-pt">
        <div className="text-sm opacity-80">{lang === 'UZ' ? 'Hamkor paneli' : 'Панель партнёра'}</div>
        <h1 className="text-2xl font-bold mt-1">{user?.firstName} {user?.lastName}</h1>
        {isApproved && (
          <div className="mt-4 bg-white/20 backdrop-blur rounded-2xl p-4">
            <div className="text-xs opacity-80">{lang === 'UZ' ? 'Umumiy balans' : 'Общий баланс'}</div>
            <div className="text-2xl font-bold mt-1">
              {formatPrice(balances?.total ?? 0)} <span className="text-sm">{lang === 'UZ' ? 'so\'m' : 'сум'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 -mt-4">
        {/* Partner PENDING banner */}
        {partnerStatus === 'PENDING' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
            <Clock className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800">
                {lang === 'UZ' ? 'Arizangiz ko\'rib chiqilmoqda' : 'Заявка на рассмотрении'}
              </div>
              <div className="text-sm text-amber-600 mt-1">
                {lang === 'UZ'
                  ? 'Administrator arizangizni tez orada ko\'rib chiqadi. Tasdiqlangandan so\'ng filial qo\'sha olasiz va boshqa imkoniyatlardan foydalanasiz.'
                  : 'Администратор скоро рассмотрит вашу заявку. После одобрения вы сможете добавлять филиалы и пользоваться другими функциями.'}
              </div>
            </div>
          </div>
        )}

        {partnerStatus === 'REJECTED' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800">
                {lang === 'UZ' ? 'Ariza rad etildi' : 'Заявка отклонена'}
              </div>
              <div className="text-sm text-red-600 mt-1">
                {lang === 'UZ'
                  ? 'Qayta ariza berish uchun botga /register buyrug\'ini yuboring.'
                  : 'Для повторной подачи отправьте команду /register боту.'}
              </div>
            </div>
          </div>
        )}

        {partnerStatus === 'BANNED' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800">
                {lang === 'UZ' ? 'Akkaunt bloklangan' : 'Аккаунт заблокирован'}
              </div>
            </div>
          </div>
        )}

        {/* Tiles - always show for navigation but some will be limited */}
        <div className="grid grid-cols-2 gap-3">
          <Tile href="/partner/branches" icon={<Building2 />} label={lang === 'UZ' ? 'Filiallar' : 'Филиалы'} />
          <Tile href="/partner/stats" icon={<BarChart3 />} label={lang === 'UZ' ? 'Statistika' : 'Статистика'} disabled={!isApproved} />
          <Tile href="/partner/balance" icon={<Wallet />} label={lang === 'UZ' ? 'Balans' : 'Баланс'} disabled={!isApproved} />
          <Tile href="/partner/scan" icon={<QrCode />} label={lang === 'UZ' ? 'QR skanerlash' : 'Сканировать QR'} disabled={!isApproved} />
        </div>
      </div>

      {/* Branch list - only when approved */}
      {isApproved && (
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
      )}
    </div>
  );
}

function Tile({ href, icon, label, disabled }: { href: string; icon: React.ReactNode; label: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="card flex flex-col items-center gap-2 py-5 opacity-40 cursor-not-allowed shadow-lg">
        <div className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
    );
  }
  return (
    <Link href={href} className="card flex flex-col items-center gap-2 py-5 active:scale-95 transition shadow-lg">
      <div className="w-11 h-11 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
