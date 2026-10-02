import { Crosshair, LayoutDashboard, PlayCircle, SearchCheck, Settings, type LucideIcon } from 'lucide-react';

export interface AppModule {
  href: string;
  label: string;
  icon: LucideIcon;
  /** `false` = shown as a disabled "coming soon" entry in the sidebar. */
  enabled: boolean;
}

/** Register new modules here: the sidebar is generated from this list. */
export const MODULES: AppModule[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
  { href: '/replayer', label: 'Replayer', icon: PlayCircle, enabled: false },
  { href: '/leakfinder', label: 'Leakfinder', icon: SearchCheck, enabled: false },
  { href: '/hud', label: 'HUD', icon: Crosshair, enabled: false },
];

export const SETTINGS_MODULE: AppModule = { href: '/settings', label: 'Réglages', icon: Settings, enabled: true };
