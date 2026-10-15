'use client';

import { useEffect, useState } from 'react';
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

/** `true` while scrolling down past the top, `false` as soon as the user scrolls back up. */
function useCompactOnScroll() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = Math.max(window.scrollY, 0);
        const delta = y - lastY;
        if (y < 24) setCompact(false);
        else if (delta > 6) setCompact(true);
        else if (delta < -6) setCompact(false);
        if (Math.abs(delta) > 6) lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return compact;
}

/** Floating tab bar for phones (< md), replaces the sidebar. */
export function BottomNav() {
  const pathname = usePathname() ?? '';
  const compact = useCompactOnScroll();

  return (
    <nav
      aria-label="Navigation principale"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 flex justify-center px-4 md:hidden"
    >
      <ul
        className={cn(
          'pointer-events-auto flex items-stretch rounded-full border border-white/10 bg-background/60 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300 ease-out',
          compact ? 'h-12 w-[15rem]' : 'h-16 w-full max-w-[24rem]',
        )}
      >
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href.slice(0, -1));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={cn(
                  'flex h-full select-none flex-col items-center justify-center rounded-full transition-all duration-300 active:scale-90',
                  active ? 'bg-foreground/10 text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon
                  className={cn('transition-all duration-300', compact ? 'size-5' : 'size-[22px]')}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    'overflow-hidden text-[10px] font-medium leading-none transition-all duration-300',
                    compact ? 'mt-0 max-h-0 opacity-0' : 'mt-1 max-h-3 opacity-100',
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
