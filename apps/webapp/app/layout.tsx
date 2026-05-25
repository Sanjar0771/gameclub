import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'GameClub',
  description: 'PC bron qilish platformasi',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
