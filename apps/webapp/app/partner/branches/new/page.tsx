'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/common';
import { hapticNotification, showAlert } from '@/lib/telegram';

export default function NewBranchPage() {
  const router = useRouter();
  const { lang, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Partner tasdiqlangan bo'lmasa — yo'naltirish
  useEffect(() => {
    if (user?.partner?.status !== 'APPROVED') {
      router.replace('/partner/branches');
    }
  }, [user, router]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    region: '',
    city: '',
    address: '',
    phone: '',
    cardNumber: '',
    cardHolderName: '',
    openTime: '09:00',
    closeTime: '24:00',
    worksAroundClock: false,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/common/regions');
      return res.ok ? res.data : [];
    },
  });

  const selectedRegion = regions?.find((r) => r.code === form.region);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
        () => {},
      );
    }
  }, []);

  const submit = async () => {
    if (!form.name || !form.region || !form.city || !form.address || !form.cardNumber) {
      await showAlert(lang === 'UZ' ? 'Hamma majburiy maydonlarni to\'ldiring' : 'Заполните все обязательные поля');
      return;
    }
    setSubmitting(true);
    // Bo'sh stringlarni olib tashlaymiz (Zod validation uchun)
    const payload: any = { ...form };
    if (!payload.phone) delete payload.phone;
    if (!payload.description) delete payload.description;
    if (!payload.cardHolderName) delete payload.cardHolderName;
    if (payload.latitude === undefined) delete payload.latitude;
    if (payload.longitude === undefined) delete payload.longitude;
    const res = await api.post<any>('/api/partner/branches', payload);
    setSubmitting(false);
    if (res.ok) {
      hapticNotification('success');
      router.replace(`/partner/branches/${res.data.id}`);
    } else {
      await showAlert(res.error.message);
    }
  };

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Yangi filial' : 'Новый филиал'} />

      <div className="p-4 space-y-3">
        <Card>
          <div className="space-y-2">
            <Field label={lang === 'UZ' ? 'Filial nomi *' : 'Название филиала *'}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </Field>
            <Field label={lang === 'UZ' ? 'Tavsif' : 'Описание'}>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px]" />
            </Field>
            <Field label={lang === 'UZ' ? 'Viloyat *' : 'Область *'}>
              <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value, city: '' })} className="input">
                <option value="">—</option>
                {(regions ?? []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {lang === 'UZ' ? r.nameUz : r.nameRu}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === 'UZ' ? 'Shahar/tuman *' : 'Город *'}>
              <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" disabled={!selectedRegion}>
                <option value="">—</option>
                {selectedRegion?.cities.map((c: any, i: number) => (
                  <option key={i} value={lang === 'UZ' ? c.nameUz : c.nameRu}>
                    {lang === 'UZ' ? c.nameUz : c.nameRu}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={lang === 'UZ' ? 'Manzil *' : 'Адрес *'}>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" placeholder={lang === 'UZ' ? 'Ko\'cha, uy, mo\'ljal' : 'Улица, дом, ориентир'} />
            </Field>
            <Field label={lang === 'UZ' ? 'Telefon' : 'Телефон'}>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="+998..." />
            </Field>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">{lang === 'UZ' ? 'Ish vaqti' : 'Часы работы'}</h3>
          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={form.worksAroundClock}
              onChange={(e) => setForm({ ...form, worksAroundClock: e.target.checked })}
              className="w-5 h-5"
            />
            <span>{lang === 'UZ' ? '24 soat ishlaydi' : 'Работает 24/7'}</span>
          </label>
          {!form.worksAroundClock && (
            <div className="grid grid-cols-2 gap-2">
              <Field label={lang === 'UZ' ? 'Ochilish' : 'Открытие'}>
                <input type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} className="input" />
              </Field>
              <Field label={lang === 'UZ' ? 'Yopilish' : 'Закрытие'}>
                <input type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} className="input" />
              </Field>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">{lang === 'UZ' ? 'To\'lov ma\'lumotlari' : 'Платёжные данные'}</h3>
          <Field label={lang === 'UZ' ? 'Karta raqami *' : 'Номер карты *'}>
            <input
              value={form.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
              onChange={(e) => setForm({ ...form, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 16) })}
              className="input font-mono tracking-wider"
              placeholder="8600 1234 5678 9012"
              inputMode="numeric"
            />
          </Field>
          <Field label={lang === 'UZ' ? 'Karta egasi' : 'Владелец карты'}>
            <input value={form.cardHolderName} onChange={(e) => setForm({ ...form, cardHolderName: e.target.value })} className="input" placeholder={lang === 'UZ' ? 'Ism Familiya' : 'Имя Фамилия'} />
          </Field>
          <p className="text-xs text-tg-hint mt-2">
            {lang === 'UZ'
              ? 'Bu kartaga mijozlardan to\'lov tushadi. Yechib olganda super-admin shu kartaga o\'tkazadi.'
              : 'На эту карту будут поступать оплаты от клиентов. При выводе средств администратор переведёт на эту карту.'}
          </p>
        </Card>

        <button onClick={submit} disabled={submitting} className="btn-primary w-full">
          {submitting ? '...' : lang === 'UZ' ? 'Saqlash' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-tg-hint">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
