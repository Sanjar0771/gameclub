'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Heart, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen } from '@/components/ui/common';

export default function FavoritesPage() {
  const { lang } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/customer/favorites');
      return res.ok ? res.data : [];
    },
  });

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Sevimlilar' : 'Избранное'} />

      <div className="px-4 py-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty
            icon={<Heart className="w-12 h-12" />}
            title={lang === 'UZ' ? 'Sevimlilar yo\'q' : 'Нет избранных'}
            description={lang === 'UZ' ? 'Gameclubni sevimlilar ro\'yxatiga qo\'shing' : 'Добавьте геймклуб в избранное'}
          />
        ) : (
          (data ?? []).map((f) => (
            <Link
              key={f.id}
              href={`/customer/branch/${f.branchId}`}
              className="block active:scale-[0.99] transition"
            >
              <Card className="!p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-tg-secondary-bg overflow-hidden flex-shrink-0">
                  {f.branch?.images?.[0]?.url && (
                    <img src={f.branch.images[0].url} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{f.branch?.name}</div>
                  <div className="flex items-center gap-1 text-xs text-tg-hint">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{f.branch?.city}</span>
                  </div>
                </div>
                <Heart className="w-5 h-5 fill-red-500 text-red-500 flex-shrink-0" />
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
