import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { SyncProvider } from '@/components/providers/sync-provider';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pokhair Tracker',
  description: 'Tracker de poker desktop — Winamax Cash Game',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SyncProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 overflow-y-auto px-4 py-5">{children}</main>
            </div>
          </div>
        </SyncProvider>
      </body>
    </html>
  );
}
