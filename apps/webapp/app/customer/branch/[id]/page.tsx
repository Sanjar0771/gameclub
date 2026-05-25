'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { MapPin, Phone, Clock, Star, Heart, Tag, Navigation as NavIcon, Gamepad2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen, Stars, Badge } from '@/components/ui/common';
import { formatPrice, formatTime, cn } from '@/lib/utils';
import { hapticImpact, hapticNotification, showAlert } from '@/lib/telegram';

interface Branch {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  region: string;
  phone?: string;
  openTime: string;
  closeTime: string;
  worksAroundClock: boolean;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  images: { id: string; url: string }[];
  computerTypes: any[];
  computers: any[];
  promotions: any[];
  ratings: any[];
  avgRating: number;
  ratingsCount: number;
}

export default function BranchDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useAuth();
  const qc = useQueryClient();

  const { data: branch, isLoading } = useQuery({
    queryKey: ['branch', id],
    queryFn: async () => {
      const res = await api.get<Branch>(`/api/customer/branches/${id}`);
      return res.ok ? res.data : null;
    },
  });

  const [activeImg, setActiveImg] = useState(0);
  const [isFav, setIsFav] = useState(false);

  const toggleFav = async () => {
    hapticImpact('medium');
    if (isFav) {
      await api.delete(`/api/customer/favorites/${id}`);
    } else {
      await api.post(`/api/customer/favorites/${id}`);
    }
    setIsFav(!isFav);
  };

  const openMap = () => {
    if (branch?.latitude && branch?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`;
      window.open(url, '_blank');
    }
  };

  if (isLoading || !branch) return <LoadingScreen />;

  const isClosed = branch.status !== 'ACTIVE';

  return (
    <div className="min-h-screen pb-24 safe-pb">
      <PageHeader
        title={branch.name}
        subtitle={`${branch.city} • ${branch.address}`}
        backHref="/customer/search"
        right={
          <button onClick={toggleFav} className="p-2 rounded-full active:bg-tg-secondary-bg">
            <Heart className={cn('w-5 h-5', isFav ? 'fill-red-500 text-red-500' : '')} />
          </button>
        }
      />

      {/* Images */}
      {branch.images.length > 0 ? (
        <div className="aspect-video bg-tg-secondary-bg relative overflow-hidden">
          <img
            src={branch.images[activeImg]?.url}
            alt={branch.name}
            className="w-full h-full object-cover"
          />
          {branch.images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {branch.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={cn('w-2 h-2 rounded-full', i === activeImg ? 'bg-white' : 'bg-white/40')}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-brand-500 to-brand-900 flex items-center justify-center">
          <Gamepad2 className="w-20 h-20 text-white/50" />
        </div>
      )}

      <div className="p-4 space-y-4">
        {isClosed && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {lang === 'UZ' ? '🚫 Bu gameclub hozir yopiq' : '🚫 Этот геймклуб сейчас закрыт'}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{branch.avgRating.toFixed(1)}</span>
            <span className="text-tg-hint text-sm">({branch.ratingsCount})</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-tg-hint">
            <Clock className="w-4 h-4" />
            <span>
              {branch.worksAroundClock
                ? lang === 'UZ' ? '24/7' : '24/7'
                : `${branch.openTime} - ${branch.closeTime}`}
            </span>
          </div>
        </div>

        {branch.description && (
          <p className="text-sm text-tg-text">{branch.description}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={openMap} className="btn-secondary flex items-center justify-center gap-2">
            <NavIcon className="w-4 h-4" />
            {lang === 'UZ' ? 'Yo\'l ko\'rsatish' : 'Маршрут'}
          </button>
          {branch.phone && (
            <a href={`tel:${branch.phone}`} className="btn-secondary flex items-center justify-center gap-2">
              <Phone className="w-4 h-4" />
              {lang === 'UZ' ? 'Qo\'ng\'iroq' : 'Позвонить'}
            </a>
          )}
        </div>

        {/* Promotions */}
        {branch.promotions.length > 0 && (
          <Card className="!bg-orange-50 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-orange-700">
                {lang === 'UZ' ? 'Aksiyalar' : 'Акции'}
              </span>
            </div>
            <div className="space-y-2">
              {branch.promotions.map((p) => (
                <div key={p.id} className="text-sm">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-tg-hint">-{p.discountPct}%</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Computer Types & Prices */}
        <div>
          <h2 className="text-base font-semibold mb-2">
            {lang === 'UZ' ? 'Narxlar' : 'Цены'}
          </h2>
          <div className="space-y-2">
            {branch.computerTypes.map((t) => (
              <Card key={t.id} className="!p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    {t.description && <div className="text-xs text-tg-hint">{t.description}</div>}
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      {lang === 'UZ' ? 'Kunduzgi' : 'Дневная'}: <span className="font-semibold">{formatPrice(t.dayPrice)}</span>
                    </div>
                    <div className="text-tg-hint">
                      {lang === 'UZ' ? 'Kechki' : 'Ночная'}: {formatPrice(t.nightPrice)}
                    </div>
                  </div>
                </div>
                {t.hasNightPackage && (
                  <div className="mt-2 pt-2 border-t border-tg-section-separator text-xs">
                    🌙 {lang === 'UZ' ? 'Tungi paket' : 'Ночной пакет'} {t.nightPackageStart} — {t.nightPackageEnd}: <b>{formatPrice(t.nightPackagePrice)} {lang === 'UZ' ? 'so\'m' : 'сум'}</b>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Ratings */}
        {branch.ratings.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-2">
              {lang === 'UZ' ? 'Izohlar' : 'Отзывы'}
            </h2>
            <div className="space-y-2">
              {branch.ratings.slice(0, 5).map((r) => (
                <Card key={r.id} className="!p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {r.customer?.firstName ?? 'User'}
                    </span>
                    <Stars value={r.stars} size={14} />
                  </div>
                  {r.comment && <p className="text-sm text-tg-text">{r.comment}</p>}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-tg-section-separator p-4 safe-pb">
        <button
          onClick={() => router.push(`/customer/branch/${id}/book`)}
          disabled={isClosed}
          className="btn-primary w-full text-base py-3.5"
        >
          {lang === 'UZ' ? 'Bron qilish' : 'Забронировать'}
        </button>
      </div>
    </div>
  );
}
