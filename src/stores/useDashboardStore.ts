import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HandFilters } from '@/lib/poker/filters';
import type { Unit } from '@/lib/poker/stats';

export type ChartAxis = 'count' | 'date';

interface DashboardState {
  filters: HandFilters;
  unit: Unit;
  axis: ChartAxis;
  setFilters: (filters: HandFilters) => void;
  setUnit: (unit: Unit) => void;
  setAxis: (axis: ChartAxis) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      filters: { date: 'all', game: 'all', limit: 'all' },
      unit: 'eur',
      axis: 'count',
      setFilters: (filters) => set({ filters }),
      setUnit: (unit) => set({ unit }),
      setAxis: (axis) => set({ axis }),
    }),
    // Rehydrated on mount to keep the static pre-render and the first client render identical.
    { name: 'pokhair-dashboard', skipHydration: true },
  ),
);
