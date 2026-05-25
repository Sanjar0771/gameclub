'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Ban, Percent } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Badge } from '@/components/ui/common';
import { cn } from '@/lib/utils';
import { hapticNotification, showAlert, showConfirm } from '@/lib/telegram';

export default function AdminPartners() {
  const { lang, user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [commissionId, setCommissionId] = useState<{ id: string; current: number } | null>(null);
  const [pct, setPct] = useState(10);
  const isSuper = user?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-partners', filter],
    queryFn: async () => {
      const url = filter ? `/api/admin/partners?status=${filter}` : '/api/admin/partners';
      const res = await api.get<any[]>(url);
      return res.ok ? res.data : [];
    },
  });

  const ban = async (id: string) => {
    const ok = await showConfirm(lang === 'UZ' ? 'Bloklaymizmi?' : 'Заблокировать?');
    if (!ok) return;
    const res = await api.post(`/api/admin/partners/${id}/ban`, { reason: 'Admin tomonidan' });
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
    }
  };

  const setCommission = async (branchId: string) => {
    if (pct < 5 || pct > 20) {
      await showAlert(lang === 'UZ' ? '5-20% oralig\'ida bo\'lishi kerak' : 'Должно быть 5-20%');
      return;
    }
    const res = await api.patch(`/api/admin/branches/${branchId}/commission`, { commissionPct: pct });
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      setCommissionId(null);
    } else {
      await showAlert((res as any).error.message);
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Hamkorlar' : 'Партнёры'} backHref="/admin" />

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        {[
          { v: '', l: lang === 'UZ' ? 'Hammasi' : 'Все' },
          { v: 'APPROVED', l: lang === 'UZ' ? 'Tasdiqlangan' : 'Одобрены' },
          { v: 'PENDING', l: lang === 'UZ' ? 'Kutmoqda' : 'Ожидают' },
          { v: 'BANNED', l: lang === 'UZ' ? 'Bloklangan' : 'Заблок.' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm whitespace-nowrap',
              filter === f.v ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
            )}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty icon={<Building2 className="w-12 h-12" />} title={lang === 'UZ' ? 'Topilmadi' : 'Не найдено'} />
        ) : (
          (data ?? []).map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{p.fullName}</div>
                  <div className="text-xs text-tg-hint">{p.phone}</div>
                  <div className="text-xs text-tg-hint">TG: @{p.user?.username ?? '—'}</div>
                </div>
                <Badge
                  variant={
                    p.status === 'APPROVED' ? 'success' : p.status === 'BANNED' ? 'danger' : 'warning'
                  }
                >
                  {p.status}
                </Badge>
              </div>
              {p.branches && p.branches.length > 0 && (
                <div className="space-y-1 mt-2 pt-2 border-t border-tg-section-separator">
                  {p.branches.map((b: any) => (
                    <div key={b.id} className="flex justify-between items-center text-sm">
                      <span>{b.name}</span>
                      {isSuper && (
                        <button
                          onClick={() => {
                            setCommissionId({ id: b.id, current: b.commissionPct ?? 10 });
                            setPct(b.commissionPct ?? 10);
                          }}
                          className="text-tg-link text-xs flex items-center gap-1"
                        >
                          <Percent className="w-3 h-3" />
                          {b.commissionPct ?? 10}%
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {p.status === 'APPROVED' && (
                <button
                  onClick={() => ban(p.id)}
                  className="mt-2 w-full !py-1.5 text-xs text-red-600 bg-red-50 rounded-lg flex items-center justify-center gap-1"
                >
                  <Ban className="w-3 h-3" />
                  {lang === 'UZ' ? 'Bloklash' : 'Заблокировать'}
                </button>
              )}
            </Card>
          ))
        )}
      </div>

      {commissionId && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setCommissionId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Komissiya foizi' : 'Процент комиссии'}</h3>
            <input
              type="range"
              min={5}
              max={20}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="w-full mb-2"
            />
            <div className="text-center text-3xl font-bold mb-4">{pct}%</div>
            <p className="text-xs text-tg-hint mb-3">5% — 20% oralig'ida</p>
            <button onClick={() => setCommission(commissionId.id)} className="btn-primary w-full">
              {lang === 'UZ' ? 'Saqlash' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
