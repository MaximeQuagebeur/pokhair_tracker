import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/sidebar';
import { SyncProvider } from '@/components/providers/sync-provider';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pok\'Hair Tracker',
  description: 'Tracker de poker desktop — Winamax Cash Game',
  applicationName: 'PokerTracker',
  appleWebApp: {
    capable: true,
    title: 'PokerTracker',
    // Content goes under the status bar: offset with env(safe-area-inset-top).
    statusBarStyle: 'black-translucent',
  },
  icons: { apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
  // Next only emits `mobile-web-app-capable`: older iOS versions still need the Apple-prefixed tag.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SyncProvider>
          <div className="flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] md:py-5">
                {children}
              </main>
            </div>
          </div>
          <BottomNav />
        </SyncProvider>
      </body>
    </html>
  );
}
