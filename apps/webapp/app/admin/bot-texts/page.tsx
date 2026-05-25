'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Edit3 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen } from '@/components/ui/common';
import { hapticNotification, showAlert } from '@/lib/telegram';

export default function BotTexts() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [textUz, setTextUz] = useState('');
  const [textRu, setTextRu] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bot-texts'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/admin/bot-texts');
      return res.ok ? res.data : [];
    },
  });

  const save = async () => {
    if (!editing) return;
    const res = await api.patch(`/api/admin/bot-texts/${editing.key}`, { textUz, textRu });
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['bot-texts'] });
      setEditing(null);
      await showAlert(lang === 'UZ' ? 'Saqlandi' : 'Сохранено');
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Bot matnlari' : 'Тексты бота'} backHref="/admin" />

      <div className="p-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (
          (data ?? []).map((t) => (
            <Card key={t.id}>
              <div className="flex justify-between items-start mb-2">
                <div className="font-mono text-xs text-tg-link">{t.key}</div>
                <button
                  onClick={() => {
                    setEditing(t);
                    setTextUz(t.textUz);
                    setTextRu(t.textRu);
                  }}
                  className="text-tg-link"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              {t.description && <div className="text-xs text-tg-hint mb-2">{t.description}</div>}
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-tg-hint">🇺🇿 UZ:</div>
                  <div className="text-sm whitespace-pre-wrap">{t.textUz}</div>
                </div>
                <div>
                  <div className="text-xs text-tg-hint">🇷🇺 RU:</div>
                  <div className="text-sm whitespace-pre-wrap">{t.textRu}</div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setEditing(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-tg-bg rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto safe-pb"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1">{editing.key}</h3>
            <div className="text-xs text-tg-hint mb-3">{editing.description}</div>
            <label className="block mb-3">
              <span className="text-xs text-tg-hint">🇺🇿 O'zbekcha</span>
              <textarea
                value={textUz}
                onChange={(e) => setTextUz(e.target.value)}
                className="input min-h-[120px] mt-1"
              />
            </label>
            <label className="block mb-3">
              <span className="text-xs text-tg-hint">🇷🇺 Русский</span>
              <textarea
                value={textRu}
                onChange={(e) => setTextRu(e.target.value)}
                className="input min-h-[120px] mt-1"
              />
            </label>
            <button onClick={save} className="btn-primary w-full">
              {lang === 'UZ' ? 'Saqlash' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
