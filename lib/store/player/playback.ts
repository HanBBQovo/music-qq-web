
import type { StateCreator } from 'zustand';
import type { PlayerStoreState, PlaybackSlice } from './types';

export const createPlaybackSlice: StateCreator<
  PlayerStoreState,
  [],
  [],
  PlaybackSlice
> = (set) => ({
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
});
