
import type { StateCreator } from 'zustand';
import type { PlayerStoreState, QualitySlice } from './types';
import type { AudioQuality } from '@/lib/api/types';

export const createQualitySlice: StateCreator<
  PlayerStoreState,
  [],
  [],
  QualitySlice
> = (set) => ({
  currentQuality: '320' as AudioQuality,
  availableQualities: [],
  qualitySizes: {},
  recommendedQuality: null,
  setCurrentQuality: async (quality) => {
    set({ currentQuality: quality });
  },
});
