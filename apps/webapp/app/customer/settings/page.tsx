'use client';

import { useState } from 'react';
import { Globe, Phone, MessageCircle, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/common';
import { cn } from '@/lib/utils';
import { hapticImpact, hapticNotification, showAlert } from '@/lib/telegram';

export default function SettingsPage() {
  const { user, lang, setLang } = useAuth();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const changeLang = async (newLang: 'UZ' | 'RU') => {
    hapticImpact('light');
    setLang(newLang);
    await api.patch('/api/common/language', { language: newLang });
  };

  const savePhone = async () => {
    if (!/^\+?998\d{9}$/.test(phone.replace(/\s/g, ''))) {
      await showAlert(lang === 'UZ' ? 'Telefon noto\'g\'ri' : 'Неверный телефон');
      return;
    }
    setSaving(true);
    const res = await api.patch('/api/common/phone', { phone: phone.replace(/\s/g, '') });
    setSaving(false);
    if (res.ok) {
      hapticNotification('success');
      await showAlert(lang === 'UZ' ? 'Saqlandi' : 'Сохранено');
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Sozlamalar' : 'Настройки'} />

      <div className="px-4 py-4 space-y-4">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-tg-hint" />
            <h3 className="font-semibold">{lang === 'UZ' ? 'Til' : 'Язык'}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => changeLang('UZ')}
              className={cn(
                'py-3 rounded-xl font-medium',
                lang === 'UZ' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
              )}
            >
              🇺🇿 O'zbekcha
            </button>
            <button
              onClick={() => changeLang('RU')}
              className={cn(
                'py-3 rounded-xl font-medium',
                lang === 'RU' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
              )}
            >
              🇷🇺 Русский
            </button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Phone className="w-5 h-5 text-tg-hint" />
            <h3 className="font-semibold">{lang === 'UZ' ? 'Telefon raqami' : 'Телефон'}</h3>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            className="input mb-2"
          />
          <button onClick={savePhone} disabled={saving} className="btn-primary w-full">
            {saving ? '...' : lang === 'UZ' ? 'Saqlash' : 'Сохранить'}
          </button>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">{lang === 'UZ' ? 'Profil' : 'Профиль'}</h3>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-tg-hint">{lang === 'UZ' ? 'Ism' : 'Имя'}:</span>{' '}
              <span>{user?.firstName} {user?.lastName}</span>
            </div>
            <div>
              <span className="text-tg-hint">Telegram:</span>{' '}
              <span>@{user?.username ?? '—'}</span>
            </div>
            <div>
              <span className="text-tg-hint">ID:</span>{' '}
              <span className="font-mono text-xs">{user?.telegramId}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
