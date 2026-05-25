'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Badge } from '@/components/ui/common';

export default function PartnerBranchesList() {
  const { lang } = useAuth();
  const { data: branches, isLoading } = useQuery({
    queryKey: ['my-branches'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/partner/branches');
      return res.ok ? res.data : [];
    },
  });

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader
        title={lang === 'UZ' ? 'Filiallarim' : 'Мои филиалы'}
        right={
          <Link href="/partner/branches/new" className="p-2 rounded-full active:bg-tg-secondary-bg">
            <Plus className="w-5 h-5" />
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (branches ?? []).length === 0 ? (
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
      </div>
    </div>
  );
}
