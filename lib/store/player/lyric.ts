
import type { StateCreator } from 'zustand';
import type { PlayerStoreState, LyricSlice } from './types';

export const createLyricSlice: StateCreator<
  PlayerStoreState,
  [],
  [],
  LyricSlice
> = (set) => ({
  krcLyrics: null,
  isKrcLyricsLoading: false,
  krcLyricsError: null,
});
