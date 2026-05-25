'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen, Badge } from '@/components/ui/common';
import { formatDateTime, cn } from '@/lib/utils';

export default function AuditLogs() {
  const { lang } = useAuth();
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', action],
    queryFn: async () => {
      const url = action ? `/api/admin/audit-logs?action=${action}&limit=100` : '/api/admin/audit-logs?limit=100';
      const res = await api.get<any[]>(url);
      return res.ok ? res.data : [];
    },
  });

  const actionOptions = [
    { v: '', l: lang === 'UZ' ? 'Hammasi' : 'Все' },
    { v: 'PARTNER_APPROVED', l: lang === 'UZ' ? 'Tasdiqlash' : 'Одобрение' },
    { v: 'PARTNER_REJECTED', l: lang === 'UZ' ? 'Rad etish' : 'Отказ' },
    { v: 'PARTNER_BANNED', l: lang === 'UZ' ? 'Bloklash' : 'Блок' },
    { v: 'PAYMENT_CONFIRMED', l: lang === 'UZ' ? 'To\'lov' : 'Оплата' },
    { v: 'COMMISSION_CHANGED', l: lang === 'UZ' ? 'Komissiya' : 'Комиссия' },
    { v: 'BOOKING_CREATED', l: lang === 'UZ' ? 'Bron' : 'Бронь' },
    { v: 'QR_CONFIRMED', l: 'QR' },
  ];

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Audit log' : 'Журнал аудита'} backHref="/admin" />

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        {actionOptions.map((f) => (
          <button
            key={f.v}
            onClick={() => setAction(f.v)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm whitespace-nowrap',
              action === f.v ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
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
          <Empty icon={<ScrollText className="w-12 h-12" />} title={lang === 'UZ' ? 'Loglar yo\'q' : 'Нет логов'} />
        ) : (
          (data ?? []).map((log) => (
            <Card key={log.id} className="!p-3">
              <div className="flex justify-between items-start mb-1">
                <div className="font-mono text-xs text-tg-link">{log.action}</div>
                <Badge variant="default">{log.actorRole}</Badge>
              </div>
              <div className="text-xs text-tg-hint">
                {lang === 'UZ' ? 'Bajaruvchi' : 'Исполнитель'}: {log.actor?.firstName ?? '—'} (TG: {log.actor?.telegramId ?? '—'})
              </div>
              <div className="text-xs text-tg-hint">
                {lang === 'UZ' ? 'Maqsad' : 'Объект'}: {log.targetType} #{log.targetId?.slice(0, 8) ?? '—'}
              </div>
              <div className="text-xs text-tg-hint">{formatDateTime(log.createdAt, lang)}</div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-tg-link cursor-pointer">
                    {lang === 'UZ' ? 'Tafsilotlar' : 'Детали'}
                  </summary>
                  <pre className="text-[10px] bg-tg-secondary-bg p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
