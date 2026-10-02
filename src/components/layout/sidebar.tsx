'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Spade } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MODULES, SETTINGS_MODULE, type AppModule } from '@/lib/modules';
import { cn } from '@/lib/utils';

function NavItem({ module, active }: { module: AppModule; active: boolean }) {
  const Icon = module.icon;
  const classes = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors';
  if (!module.enabled) {
    return (
      <span className={cn(classes, 'cursor-not-allowed text-muted-foreground/50')} aria-disabled title="Bientôt disponible">
        <Icon className="size-4" />
        <span className="flex-1">{module.label}</span>
        <Badge variant="outline" className="text-[9px] opacity-70">
          Bientôt
        </Badge>
      </span>
    );
  }
  return (
    <Link
      href={module.href}
      className={cn(
        classes,
        active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      <Icon className="size-4" />
      {module.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card/40">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Spade className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Pok'Hair Tracker</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Modules</p>
        {MODULES.map((m) => (
          <NavItem key={m.href} module={m} active={isActive(m.href)} />
        ))}
      </nav>
      <div className="border-t p-3">
        <NavItem module={SETTINGS_MODULE} active={isActive(SETTINGS_MODULE.href)} />
      </div>
    </aside>
  );
}
