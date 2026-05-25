'use client';

import { useState } from 'react';
import { Send, Users, Building2, Globe } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/common';
import { cn } from '@/lib/utils';
import { hapticNotification, showAlert, showConfirm } from '@/lib/telegram';

export default function Broadcast() {
  const { lang } = useAuth();
  const [form, setForm] = useState({
    title: '',
    messageUz: '',
    messageRu: '',
    audience: 'ALL' as 'ALL' | 'CUSTOMERS' | 'PARTNERS',
  });
  const [submitting, setSubmitting] = useState(false);

  const send = async () => {
    if (!form.title || !form.messageUz || !form.messageRu) {
      await showAlert(lang === 'UZ' ? 'Hamma maydonni to\'ldiring' : 'Заполните все поля');
      return;
    }
    const ok = await showConfirm(
      lang === 'UZ'
        ? `${audienceLabel(form.audience, lang)}ga xabar yuborilsinmi? Bu amalni bekor qilib bo'lmaydi.`
        : `Отправить рассылку (${audienceLabel(form.audience, lang)})? Это нельзя отменить.`,
    );
    if (!ok) return;

    setSubmitting(true);
    const res = await api.post<any>('/api/admin/broadcasts', form);
    if (res.ok) {
      // Yuborishni boshlash
      await api.post(`/api/admin/broadcasts/${res.data.id}/send`);
      hapticNotification('success');
      setForm({ title: '', messageUz: '', messageRu: '', audience: 'ALL' });
      await showAlert(
        lang === 'UZ'
          ? 'Yuborish boshlandi. Statistikani audit log\'da ko\'ring.'
          : 'Рассылка начата. Статистику смотрите в журнале аудита.',
      );
    } else {
      await showAlert((res as any).error.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Ommaviy yuborish' : 'Рассылка'} />

      <div className="p-4 space-y-4">
        <Card>
          <h3 className="font-semibold mb-3">{lang === 'UZ' ? 'Kimga' : 'Получатели'}</h3>
          <div className="grid grid-cols-3 gap-2">
            <AudienceBtn
              active={form.audience === 'ALL'}
              onClick={() => setForm({ ...form, audience: 'ALL' })}
              icon={<Globe />}
              label={lang === 'UZ' ? 'Hammaga' : 'Всем'}
            />
            <AudienceBtn
              active={form.audience === 'CUSTOMERS'}
              onClick={() => setForm({ ...form, audience: 'CUSTOMERS' })}
              icon={<Users />}
              label={lang === 'UZ' ? 'Mijozlar' : 'Клиенты'}
            />
            <AudienceBtn
              active={form.audience === 'PARTNERS'}
              onClick={() => setForm({ ...form, audience: 'PARTNERS' })}
              icon={<Building2 />}
              label={lang === 'UZ' ? 'Hamkorlar' : 'Партнёры'}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">{lang === 'UZ' ? 'Sarlavha' : 'Заголовок'}</h3>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input"
            placeholder={lang === 'UZ' ? 'Sarlavha (faqat ichki, mijozga ko\'rinmaydi)' : 'Заголовок (внутренний)'}
            maxLength={100}
          />
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">🇺🇿 {lang === 'UZ' ? 'O\'zbek tilida' : 'На узбекском'}</h3>
          <textarea
            value={form.messageUz}
            onChange={(e) => setForm({ ...form, messageUz: e.target.value })}
            className="input min-h-[120px]"
            placeholder={lang === 'UZ' ? 'Xabar matni...' : 'Текст сообщения...'}
            maxLength={4000}
          />
          <div className="text-xs text-tg-hint text-right mt-1">{form.messageUz.length}/4000</div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">🇷🇺 {lang === 'UZ' ? 'Rus tilida' : 'На русском'}</h3>
          <textarea
            value={form.messageRu}
            onChange={(e) => setForm({ ...form, messageRu: e.target.value })}
            className="input min-h-[120px]"
            placeholder={lang === 'UZ' ? 'Tekst soobshcheniya...' : 'Текст сообщения...'}
            maxLength={4000}
          />
          <div className="text-xs text-tg-hint text-right mt-1">{form.messageRu.length}/4000</div>
        </Card>

        <button onClick={send} disabled={submitting} className="btn-primary w-full !py-3">
          <Send className="w-5 h-5 mr-2" />
          {submitting ? '...' : lang === 'UZ' ? 'Yuborish' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}

function AudienceBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 py-3 rounded-xl',
        active ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
      )}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

function audienceLabel(a: string, lang: 'UZ' | 'RU') {
  const map: any = {
    ALL: lang === 'UZ' ? 'Hammasi' : 'Все',
    CUSTOMERS: lang === 'UZ' ? 'Mijozlar' : 'Клиенты',
    PARTNERS: lang === 'UZ' ? 'Hamkorlar' : 'Партнёры',
  };
  return map[a] ?? a;
}
