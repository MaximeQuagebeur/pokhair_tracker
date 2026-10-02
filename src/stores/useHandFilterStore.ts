import { create } from 'zustand';
import type { ReplayUnit } from '@/lib/poker/actionEngine';
import { DEFAULT_HAND_SEARCH, type HandSearchFilters } from '@/lib/poker/hand-search';

interface HandFilterState {
  filters: HandSearchFilters;
  /** Hand opened in the replayer. */
  selectedHandId: string | null;
  replayerUnit: ReplayUnit;
  soundOn: boolean;
  setFilter: <K extends keyof HandSearchFilters>(key: K, value: HandSearchFilters[K]) => void;
  resetFilters: () => void;
  selectHand: (id: string | null) => void;
  setReplayerUnit: (unit: ReplayUnit) => void;
  toggleSound: () => void;
}

export const useHandFilterStore = create<HandFilterState>()((set) => ({
  filters: DEFAULT_HAND_SEARCH,
  selectedHandId: null,
  replayerUnit: 'stake',
  soundOn: true,
  setFilter: (key, value) =>
    set((s) => ({
      filters: { ...s.filters, [key]: value, ...(key === 'game' ? { limit: 'all' } : {}) },
    })),
  resetFilters: () => set({ filters: DEFAULT_HAND_SEARCH }),
  selectHand: (id) => set({ selectedHandId: id }),
  setReplayerUnit: (replayerUnit) => set({ replayerUnit }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
}));
