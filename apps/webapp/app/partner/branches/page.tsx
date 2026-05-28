'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Building2, Clock, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Badge } from '@/components/ui/common';

export default function PartnerBranchesList() {
  const { lang, user } = useAuth();
  const partnerStatus = user?.partner?.status;

  const { data: branches, isLoading, error: queryError } = useQuery({
    queryKey: ['my-branches'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/partner/branches');
      if (!res.ok) {
        throw new Error(res.error?.message || 'API xato');
      }
      return res.data;
    },
    enabled: partnerStatus === 'APPROVED',
  });

  const isPending = partnerStatus === 'PENDING';
  const isRejected = partnerStatus === 'REJECTED';
  const isBanned = partnerStatus === 'BANNED';

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader
        title={lang === 'UZ' ? 'Filiallarim' : 'Мои филиалы'}
        right={
          partnerStatus === 'APPROVED' ? (
            <Link href="/partner/branches/new" className="p-2 rounded-full active:bg-tg-secondary-bg">
              <Plus className="w-5 h-5" />
            </Link>
          ) : null
        }
      />

      <div className="px-4 py-4 space-y-3">
        {/* Partner status banner */}
        {isPending && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <Clock className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800">
                {lang === 'UZ' ? 'Arizangiz ko\'rib chiqilmoqda' : 'Заявка на рассмотрении'}
              </div>
              <div className="text-sm text-amber-600 mt-1">
                {lang === 'UZ'
                  ? 'Administrator arizangizni tez orada ko\'rib chiqadi. Tasdiqlangandan so\'ng filial qo\'sha olasiz.'
                  : 'Администратор скоро рассмотрит вашу заявку. После одобрения вы сможете добавить филиал.'}
              </div>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
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

        {isBanned && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800">
                {lang === 'UZ' ? 'Akkaunt bloklangan' : 'Аккаунт заблокирован'}
              </div>
              <div className="text-sm text-red-600 mt-1">
                {lang === 'UZ'
                  ? 'Administratorga murojaat qiling.'
                  : 'Обратитесь к администратору.'}
              </div>
            </div>
          </div>
        )}

        {/* API error display */}
        {queryError && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800">
                {lang === 'UZ' ? 'Xatolik yuz berdi' : 'Произошла ошибка'}
              </div>
              <div className="text-sm text-red-600 mt-1">
                {queryError.message}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {partnerStatus === 'APPROVED' && (
          <>
            {isLoading ? (
              <LoadingScreen />
            ) : (branches ?? []).length === 0 && !queryError ? (
              <Empty
                icon={<Building2 className="w-12 h-12" />}
                title={lang === 'UZ' ? 'Hozircha filial yo\'q' : 'Пока нет филиалов'}
                description={lang === 'UZ' ? 'Birinchi filialingizni qo\'shing' : 'Добавьте первый филиал'}
              />
            ) : (
              (branches ?? []).map((b: any) => (
                <Link key={b.id} href={`/partner/branches/${b.id}`} className="block active:scale-[0.99] transition">
                  <Card>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">{b.name}</div>
                        <div className="text-xs text-tg-hint">{b.city} • {b.address}</div>
                      </div>
                      <Badge variant={b.status === 'ACTIVE' ? 'success' : 'warning'}>{b.status}</Badge>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span><span className="text-tg-hint">PC:</span> {b.computers?.length ?? 0}</span>
                      <span><span className="text-tg-hint">{lang === 'UZ' ? 'Yordamchilar' : 'Помощники'}:</span> {b.assistants?.length ?? 0}</span>
                      <span><span className="text-tg-hint">{lang === 'UZ' ? 'Balans' : 'Баланс'}:</span> {b.balance?.amount ?? 0}</span>
                    </div>
                  </Card>
                </Link>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
