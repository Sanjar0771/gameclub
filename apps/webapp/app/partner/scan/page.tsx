'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Camera, Type, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/common';
import { hapticImpact, hapticNotification, showAlert } from '@/lib/telegram';

export default function ScanPage() {
  const router = useRouter();
  const { lang, user } = useAuth();
  const [mode, setMode] = useState<'choice' | 'camera' | 'manual'>('choice');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const endpoint = user?.role === 'ASSISTANT' ? '/api/assistant/qr/confirm' : '/api/partner/qr/confirm';

  const confirmByCode = async () => {
    if (!code) return;
    setSubmitting(true);
    hapticImpact('medium');
    const res = await api.post(endpoint, { bookingCode: code.toUpperCase() });
    setSubmitting(false);
    if (res.ok) {
      hapticNotification('success');
      setResult({ success: true, message: lang === 'UZ' ? 'Bron tasdiqlandi!' : 'Бронь подтверждена!' });
    } else {
      hapticNotification('error');
      setResult({ success: false, message: (res as any).error.message });
    }
  };

  const confirmByPayload = async (payload: string) => {
    setSubmitting(true);
    hapticImpact('medium');
    const res = await api.post(endpoint, { payload });
    setSubmitting(false);
    if (res.ok) {
      hapticNotification('success');
      setResult({ success: true, message: lang === 'UZ' ? 'Bron tasdiqlandi!' : 'Бронь подтверждена!' });
    } else {
      hapticNotification('error');
      setResult({ success: false, message: (res as any).error.message });
    }
  };

  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${
            result.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}
        >
          {result.success ? <Check className="w-12 h-12" /> : <X className="w-12 h-12" />}
        </div>
        <h2 className="text-xl font-bold text-center mb-2">{result.message}</h2>
        <div className="flex gap-2 mt-6 w-full max-w-xs">
          <button
            onClick={() => {
              setResult(null);
              setCode('');
              setMode('choice');
            }}
            className="btn-primary flex-1"
          >
            {lang === 'UZ' ? 'Yana skanerlash' : 'Сканировать ещё'}
          </button>
          <button onClick={() => router.back()} className="btn-secondary flex-1">
            {lang === 'UZ' ? 'Chiqish' : 'Выйти'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8 safe-pb">
      <PageHeader title={lang === 'UZ' ? 'QR skanerlash' : 'Сканировать QR'} />

      <div className="p-4 space-y-4">
        {mode === 'choice' && (
          <>
            <Card>
              <p className="text-sm text-tg-hint mb-4">
                {lang === 'UZ'
                  ? 'Mijozning QR-kodini telefon kamerasi orqali yoki bron kodi orqali tasdiqlang'
                  : 'Подтвердите QR-код клиента через камеру телефона или по коду брони'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('camera')}
                  className="card flex flex-col items-center gap-2 py-6 active:scale-95"
                >
                  <Camera className="w-8 h-8 text-brand-600" />
                  <span className="text-sm font-medium">{lang === 'UZ' ? 'Kamera' : 'Камера'}</span>
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className="card flex flex-col items-center gap-2 py-6 active:scale-95"
                >
                  <Type className="w-8 h-8 text-brand-600" />
                  <span className="text-sm font-medium">{lang === 'UZ' ? 'Kod kiritish' : 'Ввести код'}</span>
                </button>
              </div>
            </Card>
          </>
        )}

        {mode === 'camera' && (
          <QrCameraScanner onScan={confirmByPayload} onClose={() => setMode('choice')} lang={lang} />
        )}

        {mode === 'manual' && (
          <Card>
            <h3 className="font-semibold mb-3">{lang === 'UZ' ? 'Bron kodini kiriting' : 'Введите код брони'}</h3>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className="input mb-3 text-center font-mono text-xl tracking-widest uppercase"
              maxLength={8}
              placeholder="XXXX-XXXX"
            />
            <p className="text-xs text-tg-hint mb-3">
              {lang === 'UZ'
                ? 'Bron kodi mijozning bron tafsilotida ko\'rinadi (8 belgi)'
                : 'Код брони показывается в деталях брони клиента (8 символов)'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setMode('choice')} className="btn-secondary flex-1">
                {lang === 'UZ' ? 'Orqaga' : 'Назад'}
              </button>
              <button onClick={confirmByCode} disabled={!code || submitting} className="btn-primary flex-1">
                {submitting ? '...' : lang === 'UZ' ? 'Tasdiqlash' : 'Подтвердить'}
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function QrCameraScanner({
  onScan,
  onClose,
  lang,
}: {
  onScan: (payload: string) => void;
  onClose: () => void;
  lang: 'UZ' | 'RU';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detector: any = null;
    let intervalId: number | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamActive(true);
        }

        // BarcodeDetector API (modern mobile browsers)
        if ('BarcodeDetector' in window) {
          // @ts-ignore
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          intervalId = window.setInterval(async () => {
            if (!videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0) {
                window.clearInterval(intervalId!);
                onScan(codes[0].rawValue);
              }
            } catch {
              // ignore individual frame errors
            }
          }, 500);
        } else {
          setError(
            lang === 'UZ'
              ? 'Brauzer QR-kodni avtomatik o\'qiy olmaydi. Kod orqali tasdiqlang.'
              : 'Браузер не поддерживает QR-сканер. Используйте ввод по коду.',
          );
        }
      } catch (e) {
        setError(
          lang === 'UZ' ? 'Kameraga ruxsat berilmadi' : 'Доступ к камере не предоставлен',
        );
      }
    })();

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan, lang]);

  return (
    <Card>
      {error ? (
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={onClose} className="btn-secondary">
            {lang === 'UZ' ? 'Orqaga' : 'Назад'}
          </button>
        </div>
      ) : (
        <>
          <div className="relative aspect-square bg-black rounded-xl overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 aspect-square border-4 border-white/70 rounded-2xl" />
            </div>
          </div>
          <p className="text-center text-sm text-tg-hint mt-3">
            {lang === 'UZ' ? 'Mijoz QR-kodiga yo\'naltiring' : 'Наведите на QR-код клиента'}
          </p>
          <button onClick={onClose} className="btn-secondary w-full mt-3">
            {lang === 'UZ' ? 'Bekor qilish' : 'Отменить'}
          </button>
        </>
      )}
    </Card>
  );
}
