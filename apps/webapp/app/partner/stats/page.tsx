'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen, Empty } from '@/components/ui/common';
import { formatPrice, cn } from '@/lib/utils';

export default function PartnerStats() {
  const { lang } = useAuth();
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const from = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ['stats', range],
    queryFn: async () => {
      const res = await api.get<any>(`/api/partner/stats?from=${from}&to=${to}`);
      return res.ok ? res.data : null;
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (!data) return <Empty title={lang === 'UZ' ? 'Ma\'lumot yo\'q' : 'Нет данных'} />;

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Statistika' : 'Статистика'} />

      <div className="p-4 space-y-4">
        {/* Range selector */}
        <div className="flex gap-2">
          {[7, 30, 90].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as 7 | 30 | 90)}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-medium',
                range === r ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
              )}
            >
              {r} {lang === 'UZ' ? 'kun' : 'дней'}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="!p-3">
            <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'Sof daromad' : 'Чистый доход'}</div>
            <div className="text-xl font-bold mt-1 text-green-600">{formatPrice(data.totalIncome)}</div>
            <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'so\'m' : 'сум'}</div>
          </Card>
          <Card className="!p-3">
            <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'Bronlar' : 'Брони'}</div>
            <div className="text-xl font-bold mt-1">{data.totalBookings}</div>
            <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'jami' : 'всего'}</div>
          </Card>
        </div>

        <Card>
          <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'Yalpi tushum' : 'Валовая выручка'}</div>
          <div className="text-2xl font-bold mt-1">{formatPrice(data.totalGross)} {lang === 'UZ' ? 'so\'m' : 'сум'}</div>
        </Card>

        {/* Daily chart */}
        {data.byDay && data.byDay.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {lang === 'UZ' ? 'Kunlik daromad' : 'Доход по дням'}
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tg-section-separator)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip
                    formatter={(v: any) => formatPrice(v) + ' ' + (lang === 'UZ' ? 'so\'m' : 'сум')}
                    contentStyle={{ background: 'var(--tg-section-bg)', border: '1px solid var(--tg-section-separator)', borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="income" stroke="#3390ec" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* By branch */}
        {data.byBranch && data.byBranch.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-3">{lang === 'UZ' ? 'Filiallar bo\'yicha' : 'По филиалам'}</h3>
            <div className="space-y-2">
              {data.byBranch.map((b: any) => (
                <div key={b.branchId} className="flex justify-between items-center text-sm">
                  <div>
                    <div className="font-medium">{b.branchName}</div>
                    <div className="text-xs text-tg-hint">{b.bookings} {lang === 'UZ' ? 'bron' : 'броней'}</div>
                  </div>
                  <div className="font-semibold text-green-600">
                    {formatPrice(b.income)}
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
