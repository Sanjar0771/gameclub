'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Badge } from '@/components/ui/common';
import { formatDateTime, cn } from '@/lib/utils';
import { hapticNotification } from '@/lib/telegram';

export default function AdminComplaints() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('OPEN');
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-complaints', filter],
    queryFn: async () => {
      const res = await api.get<any[]>(`/api/admin/complaints?status=${filter}`);
      return res.ok ? res.data : [];
    },
  });

  const resolve = async () => {
    if (!resolving || !resolution) return;
    const res = await api.patch(`/api/admin/complaints/${resolving}`, {
      status: 'RESOLVED',
      resolution,
    });
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
      setResolving(null);
      setResolution('');
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Shikoyatlar' : 'Жалобы'} />

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        {[
          { v: 'OPEN', l: lang === 'UZ' ? 'Ochiq' : 'Открытые' },
          { v: 'IN_PROGRESS', l: lang === 'UZ' ? 'Jarayonda' : 'В работе' },
          { v: 'RESOLVED', l: lang === 'UZ' ? 'Hal qilingan' : 'Решено' },
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
          <Empty icon={<MessageSquare className="w-12 h-12" />} title={lang === 'UZ' ? 'Shikoyatlar yo\'q' : 'Жалоб нет'} />
        ) : (
          (data ?? []).map((c) => (
            <Card key={c.id}>
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-sm">{c.subject}</div>
                <Badge variant={c.status === 'RESOLVED' ? 'success' : 'warning'}>{c.status}</Badge>
              </div>
              <p className="text-sm mb-2">{c.message}</p>
              <div className="text-xs text-tg-hint space-y-0.5">
                <div>
                  {lang === 'UZ' ? 'Mijoz' : 'Клиент'}: {c.customer?.firstName} {c.customer?.lastName} (TG: {c.customer?.telegramId})
                </div>
                {c.branch && <div>{lang === 'UZ' ? 'Filial' : 'Филиал'}: {c.branch.name}</div>}
                <div>{formatDateTime(c.createdAt, lang)}</div>
              </div>
              {c.resolution && (
                <div className="mt-2 pt-2 border-t border-tg-section-separator">
                  <div className="text-xs text-tg-hint">{lang === 'UZ' ? 'Yechim' : 'Решение'}:</div>
                  <div className="text-sm">{c.resolution}</div>
                </div>
              )}
              {c.status !== 'RESOLVED' && (
                <button
                  onClick={() => setResolving(c.id)}
                  className="mt-2 w-full !py-1.5 text-xs bg-green-100 text-green-700 rounded-lg flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {lang === 'UZ' ? 'Hal qilish' : 'Решить'}
                </button>
              )}
            </Card>
          ))
        )}
      </div>

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setResolving(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Yechim' : 'Решение'}</h3>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="input min-h-[100px] mb-3"
              placeholder={lang === 'UZ' ? 'Qanday hal qilindi?' : 'Как решили?'}
            />
            <button onClick={resolve} disabled={!resolution} className="btn-primary w-full">
              {lang === 'UZ' ? 'Hal qildim' : 'Решено'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
