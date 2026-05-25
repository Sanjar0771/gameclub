'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, Empty, LoadingScreen } from '@/components/ui/common';
import { hapticNotification, showAlert, showConfirm } from '@/lib/telegram';

export default function AdminPreAdmins() {
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ telegramId: '', login: '', password: '', firstName: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['pre-admins'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/admin/pre-admins');
      return res.ok ? res.data : [];
    },
  });

  const add = async () => {
    if (!form.telegramId || !form.login || !form.password) {
      await showAlert(lang === 'UZ' ? 'Hamma maydonni to\'ldiring' : 'Заполните все поля');
      return;
    }
    const res = await api.post('/api/admin/pre-admins', form);
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['pre-admins'] });
      setShowAdd(false);
      setForm({ telegramId: '', login: '', password: '', firstName: '' });
    } else {
      await showAlert((res as any).error.message);
    }
  };

  const remove = async (id: string) => {
    const ok = await showConfirm(lang === 'UZ' ? 'O\'chirilsinmi?' : 'Удалить?');
    if (!ok) return;
    const res = await api.delete(`/api/admin/pre-admins/${id}`);
    if (res.ok) {
      hapticNotification('success');
      qc.invalidateQueries({ queryKey: ['pre-admins'] });
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader
        title={lang === 'UZ' ? 'Pre-adminlar' : 'Пре-админы'}
        backHref="/admin"
        right={
          <button onClick={() => setShowAdd(true)} className="p-2 rounded-full active:bg-tg-secondary-bg">
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="p-4 space-y-2">
        {isLoading ? (
          <LoadingScreen />
        ) : (data ?? []).length === 0 ? (
          <Empty icon={<Shield className="w-12 h-12" />} title={lang === 'UZ' ? 'Pre-adminlar yo\'q' : 'Нет пре-админов'} />
        ) : (
          (data ?? []).map((pa) => (
            <Card key={pa.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{pa.user?.firstName ?? pa.login}</div>
                  <div className="text-xs text-tg-hint">@{pa.user?.username ?? '—'}</div>
                  <div className="text-xs text-tg-hint">TG: {pa.user?.telegramId}</div>
                  <div className="text-xs text-tg-hint mt-1">Login: <span className="font-mono">{pa.login}</span></div>
                  {pa.watchedBranches && pa.watchedBranches.length > 0 && (
                    <div className="text-xs text-tg-hint mt-1">
                      {lang === 'UZ' ? 'Filiallar' : 'Филиалы'}: {pa.watchedBranches.map((w: any) => w.branch.name).join(', ')}
                    </div>
                  )}
                </div>
                <button onClick={() => remove(pa.id)} className="text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Yangi pre-admin' : 'Новый пре-админ'}</h3>
            <div className="space-y-2">
              <input
                placeholder="Telegram ID"
                value={form.telegramId}
                onChange={(e) => setForm({ ...form, telegramId: e.target.value })}
                className="input"
              />
              <input
                placeholder={lang === 'UZ' ? 'Ism' : 'Имя'}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="input"
              />
              <input
                placeholder="Login"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                className="input"
              />
              <input
                type="password"
                placeholder={lang === 'UZ' ? 'Parol' : 'Пароль'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
              />
              <p className="text-xs text-tg-hint">
                {lang === 'UZ'
                  ? 'Pre-admin botda Telegram ID bilan, web-da login/parol bilan kirishi mumkin'
                  : 'Пре-админ может войти через Telegram ID в боте или login/пароль в веб'}
              </p>
              <button onClick={add} className="btn-primary w-full">
                {lang === 'UZ' ? 'Qo\'shish' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
