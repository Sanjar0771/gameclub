'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Check, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, LoadingScreen } from '@/components/ui/common';
import { formatPrice, formatTime, cn } from '@/lib/utils';
import { hapticImpact, hapticNotification, showAlert } from '@/lib/telegram';

interface BranchData {
  id: string;
  name: string;
  computers: any[];
  computerTypes: any[];
  openTime: string;
  closeTime: string;
  worksAroundClock: boolean;
  promotions: any[];
}

interface Availability {
  date: string;
  computers: {
    computerId: string;
    computerName: string;
    typeId: string;
    typeName: string;
    status: string;
    occupied: { start: string; end: string }[];
  }[];
}

const SLOT_MIN = 30;
const DURATIONS = [60, 90, 120, 180, 240, 360]; // daqiqa

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedComputer, setSelectedComputer] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const { data: branch } = useQuery({
    queryKey: ['branch', id],
    queryFn: async () => {
      const res = await api.get<BranchData>(`/api/customer/branches/${id}`);
      return res.ok ? res.data : null;
    },
  });

  const dateStr = selectedDate.toISOString().slice(0, 10);
  const { data: availability } = useQuery({
    queryKey: ['availability', id, dateStr],
    queryFn: async () => {
      const res = await api.get<Availability>(
        `/api/customer/branches/${id}/availability?date=${dateStr}`,
      );
      return res.ok ? res.data : null;
    },
    enabled: !!id,
  });

  const slots = useMemo(() => {
    if (!availability || !branch || !selectedComputer) return [];
    const comp = availability.computers.find((c) => c.computerId === selectedComputer);
    if (!comp) return [];

    const [openH, openM] = branch.openTime.split(':').map(Number);
    const [closeH, closeM] = branch.closeTime.split(':').map(Number);
    const dayStart = new Date(selectedDate);
    if (branch.worksAroundClock) {
      dayStart.setHours(0, 0, 0, 0);
    } else {
      dayStart.setHours(openH ?? 9, openM ?? 0, 0, 0);
    }
    const dayEnd = new Date(selectedDate);
    if (branch.worksAroundClock) {
      dayEnd.setHours(0, 0, 0, 0);
      dayEnd.setDate(dayEnd.getDate() + 1);
    } else {
      dayEnd.setHours(closeH ?? 24, closeM ?? 0, 0, 0);
      if (dayEnd <= dayStart) dayEnd.setDate(dayEnd.getDate() + 1);
    }

    const now = new Date();
    const occupiedRanges = comp.occupied.map((o) => ({
      start: new Date(o.start),
      end: new Date(o.end),
    }));

    const list: { start: Date; end: Date; available: boolean }[] = [];
    let cursor = new Date(dayStart);
    while (cursor.getTime() + duration * 60_000 <= dayEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + duration * 60_000);
      const overlaps = occupiedRanges.some(
        (r) => cursor < r.end && r.start < slotEnd,
      );
      const inPast = cursor < now;
      list.push({ start: new Date(cursor), end: slotEnd, available: !overlaps && !inPast });
      cursor = new Date(cursor.getTime() + SLOT_MIN * 60_000);
    }
    return list;
  }, [availability, branch, selectedComputer, selectedDate, duration]);

  const selectedTypeData = branch?.computerTypes.find((t) => t.id === selectedType);
  const promo = branch?.promotions[0];

  // Narx kalkulyatsiyasi (oddiy — kunduzgi narx + chegirma)
  const totalPrice = useMemo(() => {
    if (!selectedTypeData) return 0;
    const hours = duration / 60;
    const base = Math.round(selectedTypeData.dayPrice * hours);
    if (promo) {
      return base - Math.round((base * promo.discountPct) / 100);
    }
    return base;
  }, [selectedTypeData, duration, promo]);

  const handleBook = async () => {
    if (!selectedComputer || !selectedSlot) return;
    setSubmitting(true);
    hapticImpact('medium');
    const res = await api.post<{ id: string; code: string; payment: any }>('/api/customer/bookings', {
      computerId: selectedComputer,
      startAt: selectedSlot.toISOString(),
      durationMinutes: duration,
      promotionId: promo?.id,
    });
    setSubmitting(false);
    if (res.ok) {
      hapticNotification('success');
      router.replace(`/customer/bookings/${res.data.id}/pay`);
    } else {
      hapticNotification('error');
      await showAlert(res.error.message);
    }
  };

  if (!branch) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-32 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'Bron qilish' : 'Бронирование'} subtitle={branch.name} backHref={`/customer/branch/${id}`} />

      <div className="px-4 py-4 space-y-4">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold',
                  s <= step ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg text-tg-hint',
                )}
              >
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={cn('w-8 h-0.5', s < step ? 'bg-tg-button' : 'bg-tg-secondary-bg')} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="text-base font-semibold">
              {lang === 'UZ' ? '1. Kompyuter turini tanlang' : '1. Выберите тип компьютера'}
            </h2>
            <div className="space-y-2">
              {branch.computerTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    hapticImpact('light');
                    setSelectedType(t.id);
                    setSelectedComputer(null);
                  }}
                  className={cn(
                    'card w-full text-left active:scale-[0.99] transition',
                    selectedType === t.id && 'ring-2 ring-tg-button',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      {t.description && <div className="text-xs text-tg-hint">{t.description}</div>}
                    </div>
                    <div className="text-sm text-tg-hint">
                      {lang === 'UZ' ? 'dan' : 'от'} {formatPrice(t.dayPrice)}/{lang === 'UZ' ? 'soat' : 'час'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedType && (
              <>
                <h2 className="text-base font-semibold pt-3">
                  {lang === 'UZ' ? 'Aniq kompyuterni tanlang' : 'Выберите конкретный компьютер'}
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {branch.computers
                    .filter((c) => c.typeId === selectedType)
                    .map((c) => {
                      const isBroken = c.status === 'BROKEN';
                      return (
                        <button
                          key={c.id}
                          disabled={isBroken}
                          onClick={() => {
                            hapticImpact('light');
                            setSelectedComputer(c.id);
                          }}
                          className={cn(
                            'py-3 rounded-xl text-sm font-medium',
                            isBroken && 'bg-tg-secondary-bg text-tg-hint opacity-50',
                            !isBroken && selectedComputer === c.id && 'bg-tg-button text-tg-button-text',
                            !isBroken && selectedComputer !== c.id && 'bg-tg-secondary-bg',
                          )}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            {selectedComputer && (
              <button onClick={() => setStep(2)} className="btn-primary w-full mt-4">
                {lang === 'UZ' ? 'Davom etish' : 'Продолжить'}
              </button>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-base font-semibold">
              {lang === 'UZ' ? '2. Sana va vaqtni tanlang' : '2. Выберите дату и время'}
            </h2>

            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const isActive = d.toDateString() === selectedDate.toDateString();
                return (
                  <button
                    key={i}
                    onClick={() => {
                      hapticImpact('light');
                      setSelectedDate(d);
                      setSelectedSlot(null);
                    }}
                    className={cn(
                      'flex-shrink-0 w-16 py-2 rounded-xl text-center',
                      isActive ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
                    )}
                  >
                    <div className="text-xs">
                      {d.toLocaleDateString(lang === 'UZ' ? 'uz-UZ' : 'ru-RU', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold">{d.getDate()}</div>
                  </button>
                );
              })}
            </div>

            <h3 className="text-sm font-medium pt-2">{lang === 'UZ' ? 'Davomiylik' : 'Длительность'}</h3>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    hapticImpact('light');
                    setDuration(d);
                    setSelectedSlot(null);
                  }}
                  className={cn(
                    'py-2 rounded-xl text-sm font-medium',
                    duration === d ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg',
                  )}
                >
                  {d >= 60 ? `${d / 60} ${lang === 'UZ' ? 'soat' : 'ч'}` : `${d} ${lang === 'UZ' ? 'daq' : 'мин'}`}
                </button>
              ))}
            </div>

            <h3 className="text-sm font-medium pt-2">{lang === 'UZ' ? 'Boshlanish vaqti' : 'Время начала'}</h3>
            <div className="grid grid-cols-4 gap-2">
              {slots.length === 0 && (
                <div className="col-span-4 text-center text-tg-hint py-8 text-sm">
                  {lang === 'UZ' ? 'Bo\'sh vaqt yo\'q' : 'Нет свободного времени'}
                </div>
              )}
              {slots.map((s) => (
                <button
                  key={s.start.toISOString()}
                  disabled={!s.available}
                  onClick={() => {
                    hapticImpact('light');
                    setSelectedSlot(s.start);
                  }}
                  className={cn(
                    'py-2 rounded-lg text-sm',
                    !s.available && 'bg-tg-secondary-bg text-tg-hint opacity-40 line-through',
                    s.available && selectedSlot?.getTime() === s.start.getTime() && 'bg-tg-button text-tg-button-text',
                    s.available && selectedSlot?.getTime() !== s.start.getTime() && 'bg-tg-secondary-bg',
                  )}
                >
                  {formatTime(s.start)}
                </button>
              ))}
            </div>

            {selectedSlot && (
              <button onClick={() => setStep(3)} className="btn-primary w-full mt-4">
                {lang === 'UZ' ? 'Davom etish' : 'Продолжить'}
              </button>
            )}
          </>
        )}

        {step === 3 && selectedSlot && (
          <>
            <h2 className="text-base font-semibold">
              {lang === 'UZ' ? '3. Tasdiqlash' : '3. Подтверждение'}
            </h2>

            <Card>
              <div className="space-y-3">
                <Row label={lang === 'UZ' ? 'Gameclub' : 'Геймклуб'} value={branch.name} />
                <Row
                  label={lang === 'UZ' ? 'Kompyuter' : 'Компьютер'}
                  value={branch.computers.find((c) => c.id === selectedComputer)?.name}
                />
                <Row
                  label={lang === 'UZ' ? 'Sana' : 'Дата'}
                  value={selectedDate.toLocaleDateString(lang === 'UZ' ? 'uz-UZ' : 'ru-RU')}
                />
                <Row
                  label={lang === 'UZ' ? 'Vaqt' : 'Время'}
                  value={`${formatTime(selectedSlot)} — ${formatTime(new Date(selectedSlot.getTime() + duration * 60_000))}`}
                />
                <Row
                  label={lang === 'UZ' ? 'Davomiylik' : 'Длительность'}
                  value={`${duration / 60} ${lang === 'UZ' ? 'soat' : 'ч'}`}
                />
                {promo && (
                  <Row
                    label={lang === 'UZ' ? 'Chegirma' : 'Скидка'}
                    value={`-${promo.discountPct}%`}
                    accent
                  />
                )}
                <div className="border-t border-tg-section-separator pt-3 flex justify-between items-center">
                  <span className="font-semibold">{lang === 'UZ' ? 'Jami' : 'Итого'}</span>
                  <span className="text-xl font-bold text-brand-600">
                    {formatPrice(totalPrice)} {lang === 'UZ' ? 'so\'m' : 'сум'}
                  </span>
                </div>
              </div>
            </Card>

            <div className="text-xs text-tg-hint">
              {lang === 'UZ'
                ? 'Bron yaratilgandan keyin to\'lov karta raqami ko\'rsatiladi. To\'lov tasdiqlangach QR-kod yuboriladi.'
                : 'После создания брони будет показан номер карты. После подтверждения оплаты вам отправят QR-код.'}
            </div>

            <button onClick={handleBook} disabled={submitting} className="btn-primary w-full">
              {submitting ? '...' : lang === 'UZ' ? 'Bron qilish va to\'lashga o\'tish' : 'Забронировать и перейти к оплате'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value?: string | null; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-tg-hint text-sm">{label}</span>
      <span className={cn('font-medium', accent && 'text-green-600')}>{value}</span>
    </div>
  );
}
