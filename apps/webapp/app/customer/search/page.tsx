'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { MapPin, Star, Filter, X, List, Map as MapIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Skeleton, Stars } from '@/components/ui/common';
import { formatPrice, cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/telegram';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

interface Branch {
  id: string;
  name: string;
  city: string;
  region: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  image?: string | null;
  minPrice: number | null;
  avgRating: number;
  ratingsCount: number;
  availableComputers: number;
  totalComputers: number;
  hasPromo: boolean;
  distance: number | null;
  computerTypes: { id: string; name: string; dayPrice: number; nightPrice: number }[];
}

export default function CustomerSearch() {
  const { lang } = useAuth();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [filters, setFilters] = useState({
    sort: 'distance' as 'distance' | 'rating' | 'price',
    hasPromo: false,
    minRating: 0,
    computerType: '',
    search: '',
  });
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords({ lat: 41.2995, lng: 69.2401 }), // Toshkent
        { timeout: 5000, maximumAge: 600_000 },
      );
    }
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (coords) {
      p.set('lat', coords.lat.toString());
      p.set('lng', coords.lng.toString());
    }
    p.set('sort', filters.sort);
    if (filters.hasPromo) p.set('hasPromo', 'true');
    if (filters.minRating) p.set('minRating', filters.minRating.toString());
    if (filters.computerType) p.set('computerType', filters.computerType);
    if (filters.search) p.set('search', filters.search);
    return p.toString();
  }, [coords, filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['branches', queryString],
    queryFn: async () => {
      const res = await api.get<Branch[]>(`/api/customer/branches?${queryString}`);
      return res.ok ? res.data : [];
    },
    enabled: coords !== null || filters.search.length > 0,
  });

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader
        title={lang === 'UZ' ? 'Gameclub topish' : 'Поиск геймклубов'}
        backHref="/customer"
        right={
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                hapticImpact('light');
                setView(view === 'list' ? 'map' : 'list');
              }}
              className="p-2 rounded-full active:bg-tg-secondary-bg"
              aria-label="Ko'rinish"
            >
              {view === 'list' ? <MapIcon className="w-5 h-5" /> : <List className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowFilter(true)}
              className="p-2 rounded-full active:bg-tg-secondary-bg"
              aria-label="Filter"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <div className="px-4 py-3">
        <input
          type="text"
          placeholder={lang === 'UZ' ? 'Nomi yoki manzili...' : 'Название или адрес...'}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="input"
        />
      </div>

      {view === 'map' && coords && (
        <div className="h-[55vh] mx-4 rounded-2xl overflow-hidden">
          <MapView center={[coords.lat, coords.lng]} branches={data ?? []} />
        </div>
      )}

      {view === 'list' && (
        <div className="px-4 space-y-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : (data ?? []).length === 0
              ? (
                <Empty
                  title={lang === 'UZ' ? 'Topilmadi' : 'Не найдено'}
                  description={lang === 'UZ' ? 'Filtrlarni o\'zgartirib ko\'ring' : 'Попробуйте изменить фильтры'}
                />
              )
              : (data ?? []).map((b) => <BranchCard key={b.id} branch={b} lang={lang} />)}
        </div>
      )}

      {showFilter && (
        <FilterSheet
          filters={filters}
          setFilters={setFilters}
          onClose={() => setShowFilter(false)}
          lang={lang}
        />
      )}
    </div>
  );
}

function BranchCard({ branch, lang }: { branch: Branch; lang: 'UZ' | 'RU' }) {
  return (
    <Link href={`/customer/branch/${branch.id}`} className="block active:scale-[0.99] transition">
      <Card className="!p-0 overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-brand-500 to-brand-900 relative">
          {branch.image && (
            <img src={branch.image} alt={branch.name} className="w-full h-full object-cover" />
          )}
          {branch.hasPromo && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {lang === 'UZ' ? '🔥 Aksiya' : '🔥 Акция'}
            </span>
          )}
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {branch.availableComputers}/{branch.totalComputers} {lang === 'UZ' ? 'bo\'sh' : 'свободно'}
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-tg-text">{branch.name}</h3>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{branch.avgRating.toFixed(1)}</span>
              <span className="text-tg-hint">({branch.ratingsCount})</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-tg-hint mt-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{branch.city} • {branch.address}</span>
            {branch.distance !== null && (
              <span className="ml-auto">{branch.distance} {lang === 'UZ' ? 'km' : 'км'}</span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-1 flex-wrap">
              {branch.computerTypes.slice(0, 3).map((t) => (
                <span key={t.id} className="text-[10px] bg-tg-secondary-bg px-2 py-0.5 rounded-full">
                  {t.name}
                </span>
              ))}
            </div>
            {branch.minPrice && (
              <div className="text-sm font-semibold text-brand-600">
                {lang === 'UZ' ? 'dan' : 'от'} {formatPrice(branch.minPrice)} {lang === 'UZ' ? 'so\'m' : 'сум'}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function FilterSheet({
  filters,
  setFilters,
  onClose,
  lang,
}: {
  filters: any;
  setFilters: any;
  onClose: () => void;
  lang: 'UZ' | 'RU';
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-tg-bg rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto safe-pb"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{lang === 'UZ' ? 'Filterlar' : 'Фильтры'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full active:bg-tg-secondary-bg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {lang === 'UZ' ? 'Saralash' : 'Сортировка'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['distance', 'rating', 'price'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilters({ ...filters, sort: s })}
                  className={cn(
                    'py-2 rounded-xl text-sm font-medium',
                    filters.sort === s ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
                  )}
                >
                  {s === 'distance' ? (lang === 'UZ' ? 'Yaqinlik' : 'Близость') : s === 'rating' ? (lang === 'UZ' ? 'Reyting' : 'Рейтинг') : (lang === 'UZ' ? 'Narx' : 'Цена')}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between p-3 bg-tg-secondary-bg rounded-xl">
            <span className="text-sm">{lang === 'UZ' ? 'Aksiya bor' : 'Со скидкой'}</span>
            <input
              type="checkbox"
              checked={filters.hasPromo}
              onChange={(e) => setFilters({ ...filters, hasPromo: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {lang === 'UZ' ? 'Minimal reyting' : 'Минимальный рейтинг'}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[0, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilters({ ...filters, minRating: r })}
                  className={cn(
                    'py-2 rounded-xl text-sm',
                    filters.minRating === r ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
                  )}
                >
                  {r === 0 ? 'Все' : `${r}+`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {lang === 'UZ' ? 'PC turi' : 'Тип ПК'}
            </label>
            <div className="flex gap-2 flex-wrap">
              {['', 'Standart', 'VIP', 'PS5', 'Sim-racing'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilters({ ...filters, computerType: t })}
                  className={cn(
                    'py-1.5 px-3 rounded-full text-sm',
                    filters.computerType === t ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
                  )}
                >
                  {t || (lang === 'UZ' ? 'Hammasi' : 'Все')}
                </button>
              ))}
            </div>
          </div>

          <button onClick={onClose} className="btn-primary w-full">
            {lang === 'UZ' ? 'Qo\'llash' : 'Применить'}
          </button>
        </div>
      </div>
    </div>
  );
}
