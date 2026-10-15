'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, List, PlayCircle, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hands/', label: 'Mains', icon: List },
  { href: '/replayer/', label: 'Replayer', icon: PlayCircle },
  { href: '/settings/', label: 'Réglages', icon: Settings },
];

/** Mobile tab bar (< md), replaces the sidebar. Height: 4rem + home-indicator safe area. */
export function BottomNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      aria-label="Navigation principale"
    >
      <ul className="mx-auto flex h-16 max-w-md items-stretch">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href.slice(0, -1));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full select-none flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors [-webkit-tap-highlight-color:transparent] active:opacity-60',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
