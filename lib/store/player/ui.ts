
import type { StateCreator } from 'zustand';
import type { PlayerStoreState, UISlice } from './types';

export const createUISlice: StateCreator<
  PlayerStoreState,
  [],
  [],
  UISlice
> = (set) => ({
  showPlayer: false,
  showPlaylist: false,
  setShowPlayer: (show: boolean) => set(() => ({ showPlayer: show })),
  setShowPlaylist: (show: boolean) => set(() => ({ showPlaylist: show })),
});
