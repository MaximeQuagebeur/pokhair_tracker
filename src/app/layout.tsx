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
          {/* Phones scroll the document (native iOS feel); desktop keeps the fixed sidebar layout. */}
          <div className="flex md:h-dvh md:overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] md:overflow-y-auto md:py-5">
                {children}
              </main>
            </div>
          </div>
          {/* Blurred strip behind the translucent iOS status bar. */}
          <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-background/70 backdrop-blur-xl md:hidden" />
          <BottomNav />
        </SyncProvider>
      </body>
    </html>
  );
}
