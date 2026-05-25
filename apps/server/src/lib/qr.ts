import QRCode from 'qrcode';
import * as crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * QR kontent: bookingId + HMAC signature
 * Bu QR kontentni soxtalashtirib bo'lmaydi.
 */
export function generateQrPayload(bookingId: string): string {
  const sig = crypto
    .createHmac('sha256', config.QR_SECRET ?? config.JWT_SECRET)
    .update(bookingId)
    .digest('hex')
    .slice(0, 16);
  return `GC:${bookingId}:${sig}`;
}

export function verifyQrPayload(payload: string): string | null {
  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== 'GC') return null;
  const [, bookingId, sig] = parts as [string, string, string];
  const expected = crypto
    .createHmac('sha256', config.QR_SECRET ?? config.JWT_SECRET)
    .update(bookingId)
    .digest('hex')
    .slice(0, 16);
  if (expected !== sig) return null;
  return bookingId;
}

/**
 * PNG buffer ko'rinishida QR rasm
 */
export async function generateQrImage(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
