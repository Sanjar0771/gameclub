'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit3, Power, Users, Tag, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen, Badge } from '@/components/ui/common';
import { formatPrice, cn } from '@/lib/utils';
import { hapticImpact, showAlert, showConfirm } from '@/lib/telegram';

export default function PartnerBranchDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'computers' | 'pricing' | 'bookings' | 'assistants'>('overview');

  const { data: branches, isLoading } = useQuery({
    queryKey: ['my-branches'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/partner/branches');
      return res.ok ? res.data : [];
    },
  });

  const branch = branches?.find((b) => b.id === id);

  const toggleStatus = async () => {
    if (!branch) return;
    const newStatus = branch.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    const ok = await showConfirm(
      lang === 'UZ'
        ? `Filialni ${newStatus === 'CLOSED' ? 'vaqtincha yopish' : 'qaytadan ochish'}ni xohlaysizmi?`
        : `${newStatus === 'CLOSED' ? 'Временно закрыть' : 'Снова открыть'} филиал?`,
    );
    if (!ok) return;
    hapticImpact('medium');
    await api.post(`/api/partner/branches/${id}/toggle-status`, { status: newStatus });
    qc.invalidateQueries({ queryKey: ['my-branches'] });
  };

  if (isLoading || !branch) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={branch.name} subtitle={branch.address} />

      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        {(['overview', 'computers', 'pricing', 'bookings', 'assistants'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm whitespace-nowrap',
              tab === t ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
            )}
          >
            {tabLabel(t, lang)}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {tab === 'overview' && (
          <>
            <Card>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <Badge variant={branch.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {branch.status}
                  </Badge>
                </div>
                <button onClick={toggleStatus} className="btn-secondary !py-1.5 text-sm">
                  <Power className="w-4 h-4 mr-1" />
                  {branch.status === 'ACTIVE'
                    ? lang === 'UZ' ? 'Yopish' : 'Закрыть'
                    : lang === 'UZ' ? 'Ochish' : 'Открыть'}
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <div><span className="text-tg-hint">{lang === 'UZ' ? 'Manzil' : 'Адрес'}:</span> {branch.address}</div>
                <div><span className="text-tg-hint">{lang === 'UZ' ? 'Ish vaqti' : 'Часы'}:</span> {branch.openTime} — {branch.closeTime}</div>
                <div><span className="text-tg-hint">{lang === 'UZ' ? 'Karta' : 'Карта'}:</span> {branch.cardNumber.slice(0, 4)}****{branch.cardNumber.slice(-4)}</div>
                <div><span className="text-tg-hint">{lang === 'UZ' ? 'Komissiya' : 'Комиссия'}:</span> {branch.commissionPct}%</div>
              </div>
            </Card>

            <button
              onClick={() => router.push(`/partner/branches/${id}/edit`)}
              className="btn-secondary w-full"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              {lang === 'UZ' ? 'Tahrirlash' : 'Редактировать'}
            </button>
          </>
        )}

        {tab === 'computers' && (
          <ComputersTab branchId={id} branch={branch} lang={lang} />
        )}

        {tab === 'pricing' && (
          <PricingTab branchId={id} branch={branch} lang={lang} />
        )}

        {tab === 'bookings' && (
          <BookingsTab branchId={id} lang={lang} />
        )}

        {tab === 'assistants' && (
          <AssistantsTab branchId={id} lang={lang} />
        )}
      </div>
    </div>
  );
}

function tabLabel(t: string, lang: 'UZ' | 'RU') {
  const labels: Record<string, { UZ: string; RU: string }> = {
    overview: { UZ: 'Umumiy', RU: 'Обзор' },
    computers: { UZ: 'PClar', RU: 'ПК' },
    pricing: { UZ: 'Narxlar', RU: 'Цены' },
    bookings: { UZ: 'Bronlar', RU: 'Брони' },
    assistants: { UZ: 'Yordamchilar', RU: 'Помощники' },
  };
  return labels[t]?.[lang] ?? t;
}

function ComputersTab({ branchId, branch, lang }: { branchId: string; branch: any; lang: 'UZ' | 'RU' }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');

  const addComputer = async () => {
    if (!name || !typeId) return;
    const res = await api.post(`/api/partner/branches/${branchId}/computers`, { name, typeId });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['my-branches'] });
      setShowAdd(false);
      setName('');
    } else {
      await showAlert((res as any).error.message);
    }
  };

  const toggleComputerStatus = async (cid: string, current: string) => {
    const newStatus = current === 'BROKEN' ? 'AVAILABLE' : 'BROKEN';
    await api.patch(`/api/partner/computers/${cid}`, { status: newStatus });
    qc.invalidateQueries({ queryKey: ['my-branches'] });
  };

  return (
    <>
      <button onClick={() => setShowAdd(true)} className="btn-primary w-full">
        <Plus className="w-4 h-4 mr-2" />
        {lang === 'UZ' ? 'Yangi PC qo\'shish' : 'Добавить ПК'}
      </button>

      <div className="space-y-2">
        {branch.computers.map((c: any) => (
          <Card key={c.id} className="!p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-tg-hint" />
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-tg-hint">{c.type?.name}</div>
                </div>
              </div>
              <button
                onClick={() => toggleComputerStatus(c.id, c.status)}
                className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  c.status === 'BROKEN' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
                )}
              >
                {c.status}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Yangi PC' : 'Новый ПК'}</h3>
            <input
              placeholder={lang === 'UZ' ? 'Nomi (masalan: PC-1)' : 'Название (например: PC-1)'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mb-2"
            />
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="input mb-3">
              <option value="">{lang === 'UZ' ? 'Turini tanlang' : 'Выберите тип'}</option>
              {branch.computerTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button onClick={addComputer} className="btn-primary w-full">
              {lang === 'UZ' ? 'Qo\'shish' : 'Добавить'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function PricingTab({ branchId, branch, lang }: { branchId: string; branch: any; lang: 'UZ' | 'RU' }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    dayPrice: 10000,
    nightPrice: 15000,
    dayStartTime: '08:00',
    dayEndTime: '18:00',
    hasNightPackage: false,
    nightPackagePrice: 80000,
    nightPackageStart: '22:00',
    nightPackageEnd: '08:00',
  });

  const addType = async () => {
    const res = await api.post(`/api/partner/branches/${branchId}/computer-types`, form);
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['my-branches'] });
      setShowAdd(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowAdd(true)} className="btn-primary w-full">
        <Plus className="w-4 h-4 mr-2" />
        {lang === 'UZ' ? 'Yangi tur qo\'shish' : 'Новый тип'}
      </button>

      <div className="space-y-2">
        {branch.computerTypes.map((t: any) => (
          <Card key={t.id}>
            <div className="font-semibold mb-2">{t.name}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-tg-hint text-xs">{lang === 'UZ' ? 'Kunduzgi' : 'Дневная'}</div>
                <div className="font-medium">{formatPrice(t.dayPrice)}/{lang === 'UZ' ? 'soat' : 'ч'}</div>
                <div className="text-xs text-tg-hint">{t.dayStartTime} — {t.dayEndTime}</div>
              </div>
              <div>
                <div className="text-tg-hint text-xs">{lang === 'UZ' ? 'Kechki' : 'Ночная'}</div>
                <div className="font-medium">{formatPrice(t.nightPrice)}/{lang === 'UZ' ? 'soat' : 'ч'}</div>
              </div>
            </div>
            {t.hasNightPackage && (
              <div className="mt-2 pt-2 border-t border-tg-section-separator text-sm">
                🌙 {lang === 'UZ' ? 'Tungi paket' : 'Ночной пакет'}: <b>{formatPrice(t.nightPackagePrice)}</b> ({t.nightPackageStart}—{t.nightPackageEnd})
              </div>
            )}
          </Card>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Yangi PC turi' : 'Новый тип ПК'}</h3>
            <div className="space-y-2">
              <input placeholder="Standart / VIP / PS5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder={lang === 'UZ' ? 'Kunduzgi' : 'Дневная'} value={form.dayPrice} onChange={(e) => setForm({ ...form, dayPrice: Number(e.target.value) })} className="input" />
                <input type="number" placeholder={lang === 'UZ' ? 'Kechki' : 'Ночная'} value={form.nightPrice} onChange={(e) => setForm({ ...form, nightPrice: Number(e.target.value) })} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={form.dayStartTime} onChange={(e) => setForm({ ...form, dayStartTime: e.target.value })} className="input" />
                <input type="time" value={form.dayEndTime} onChange={(e) => setForm({ ...form, dayEndTime: e.target.value })} className="input" />
              </div>
              <label className="flex items-center gap-2 p-2">
                <input type="checkbox" checked={form.hasNightPackage} onChange={(e) => setForm({ ...form, hasNightPackage: e.target.checked })} className="w-5 h-5" />
                <span>{lang === 'UZ' ? 'Tungi paket bor' : 'Есть ночной пакет'}</span>
              </label>
              {form.hasNightPackage && (
                <>
                  <input type="number" placeholder={lang === 'UZ' ? 'Paket narxi' : 'Цена пакета'} value={form.nightPackagePrice} onChange={(e) => setForm({ ...form, nightPackagePrice: Number(e.target.value) })} className="input" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="time" value={form.nightPackageStart} onChange={(e) => setForm({ ...form, nightPackageStart: e.target.value })} className="input" />
                    <input type="time" value={form.nightPackageEnd} onChange={(e) => setForm({ ...form, nightPackageEnd: e.target.value })} className="input" />
                  </div>
                </>
              )}
              <button onClick={addType} className="btn-primary w-full">{lang === 'UZ' ? 'Saqlash' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BookingsTab({ branchId, lang }: { branchId: string; lang: 'UZ' | 'RU' }) {
  const { data: bookings } = useQuery({
    queryKey: ['branch-bookings', branchId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/api/partner/branches/${branchId}/bookings`);
      return res.ok ? res.data : [];
    },
  });

  return (
    <div className="space-y-2">
      {(bookings ?? []).slice(0, 30).map((b) => (
        <Card key={b.id} className="!p-3">
          <div className="flex justify-between items-start mb-1">
            <div className="font-medium text-sm">{b.customer?.firstName ?? 'Mijoz'}</div>
            <Badge>{b.status}</Badge>
          </div>
          <div className="text-xs text-tg-hint">
            {b.computer?.name} • {new Date(b.startAt).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}
          </div>
          <div className="text-sm font-semibold mt-1">{formatPrice(b.partnerAmount)} {lang === 'UZ' ? 'so\'m' : 'сум'}</div>
        </Card>
      ))}
    </div>
  );
}

function AssistantsTab({ branchId, lang }: { branchId: string; lang: 'UZ' | 'RU' }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [tgId, setTgId] = useState('');

  const { data: assistants } = useQuery({
    queryKey: ['assistants', branchId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/api/partner/branches/${branchId}/assistants`);
      return res.ok ? res.data : [];
    },
  });

  const add = async () => {
    if (!tgId) return;
    const res = await api.post(`/api/partner/branches/${branchId}/assistants`, { telegramId: tgId, branchId });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['assistants', branchId] });
      setShowAdd(false);
      setTgId('');
    } else {
      await showAlert((res as any).error.message);
    }
  };

  const remove = async (id: string) => {
    const ok = await showConfirm(lang === 'UZ' ? 'O\'chirilsinmi?' : 'Удалить?');
    if (!ok) return;
    await api.delete(`/api/partner/assistants/${id}`);
    qc.invalidateQueries({ queryKey: ['assistants', branchId] });
  };

  return (
    <>
      <button onClick={() => setShowAdd(true)} className="btn-primary w-full">
        <Plus className="w-4 h-4 mr-2" />
        {lang === 'UZ' ? 'Yordamchi qo\'shish' : 'Добавить помощника'}
      </button>

      <div className="space-y-2">
        {(assistants ?? []).map((a) => (
          <Card key={a.id} className="!p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{a.user?.firstName ?? '—'}</div>
              <div className="text-xs text-tg-hint">ID: {a.user?.telegramId}</div>
            </div>
            <button onClick={() => remove(a.id)} className="text-red-500 text-sm">
              {lang === 'UZ' ? 'O\'chirish' : 'Удалить'}
            </button>
          </Card>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-tg-bg rounded-t-3xl p-5 safe-pb" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{lang === 'UZ' ? 'Yordamchi qo\'shish' : 'Добавить помощника'}</h3>
            <input
              placeholder={lang === 'UZ' ? 'Telegram ID' : 'Telegram ID'}
              value={tgId}
              onChange={(e) => setTgId(e.target.value)}
              className="input mb-3"
            />
            <p className="text-xs text-tg-hint mb-3">
              {lang === 'UZ'
                ? 'Yordamchi @userinfobot orqali o\'z Telegram ID raqamini bilishi mumkin'
                : 'Помощник может узнать свой Telegram ID через @userinfobot'}
            </p>
            <button onClick={add} className="btn-primary w-full">
              {lang === 'UZ' ? 'Qo\'shish' : 'Добавить'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
