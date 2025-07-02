import type { StateCreator } from "zustand";
import type { PlayerStoreState, PlaylistSlice } from "./types";
import type { Song } from "@/lib/types/music";

export const createPlaylistSlice: StateCreator<
  PlayerStoreState,
  [],
  [],
  PlaylistSlice
> = (set, get) => ({
  playlist: [],
  currentIndex: -1,
  currentSong: null,
  playMode: "order",

  playNext: async () => {
    const { playMode, _getNextIndex, playlist, playSong, currentSong } = get();
    if (playMode === "loop" && currentSong) {
      await playSong(currentSong);
      return;
    }
    const nextIndex = _getNextIndex();
    if (nextIndex >= 0 && nextIndex < playlist.length) {
      const nextSong = playlist[nextIndex];
      await playSong(nextSong);
    }
  },

  playPrevious: async () => {
    const { playMode, _getPreviousIndex, playlist, playSong, currentSong } =
      get();
    if (playMode === "loop" && currentSong) {
      await playSong(currentSong);
      return;
    }
    const prevIndex = _getPreviousIndex();
    if (prevIndex >= 0 && prevIndex < playlist.length) {
      const prevSong = playlist[prevIndex];
      await playSong(prevSong);
    }
  },

  playAtIndex: async (index) => {
    const state = get();
    if (index >= 0 && index < state.playlist.length) {
      const song = state.playlist[index];
      await state.playSong(song);
    }
  },

  setPlayMode: (mode) => set({ playMode: mode }),

  addToPlaylist: (song) => {
    set((state) => {
      const exists = state.playlist.find(
        (s) => s.mid === song.mid || s.id === song.id
      );
      if (!exists) {
        return { playlist: [...state.playlist, song] };
      }
      return {};
    });
  },

  addMultipleToPlaylist: (songs) => {
    set((state) => {
      const newSongs = songs.filter(
        (song) =>
          !state.playlist.find((s) => s.mid === song.mid || s.id === song.id)
      );
      return { playlist: [...state.playlist, ...newSongs] };
    });
  },

  removeFromPlaylist: (index) => {
    const wasPlayingRemovedSong = index === get().currentIndex;
    const wasPlaying = get().isPlaying;

    set((state) => {
      const newPlaylist = state.playlist.filter((_, i) => i !== index);

      if (newPlaylist.length === 0) {
        return {
          playlist: [],
          currentIndex: -1,
          currentSong: null,
          isPlaying: false,
          krcLyrics: null,
          isKrcLyricsLoading: false,
          krcLyricsError: null,
        };
      }

      if (index === state.currentIndex) {
        let newCurrentIndex = -1;
        let newCurrentSong = null;

        if (index < newPlaylist.length) {
          newCurrentIndex = index;
        } else {
          newCurrentIndex = newPlaylist.length - 1;
        }
        newCurrentSong = newPlaylist[newCurrentIndex];

        return {
          playlist: newPlaylist,
          currentIndex: newCurrentIndex,
          currentSong: newCurrentSong,
          isPlaying: false,
          krcLyrics: null,
          isKrcLyricsLoading: false,
          krcLyricsError: null,
        };
      } else {
        const currentSongIdentifier =
          state.currentSong?.id || state.currentSong?.mid;
        if (currentSongIdentifier) {
          const newCurrentIndex = newPlaylist.findIndex(
            (song) =>
              song.id === currentSongIdentifier ||
              song.mid === currentSongIdentifier
          );
          if (newCurrentIndex >= 0) {
            return { playlist: newPlaylist, currentIndex: newCurrentIndex };
          }
        }
        return { playlist: newPlaylist };
      }
    });

    if (wasPlayingRemovedSong && wasPlaying) {
      const newState = get();
      if (newState.currentSong && newState.playlist.length > 0) {
        newState.playSong(newState.currentSong);
      }
    }
  },

  clearPlaylist: () =>
    set({
      playlist: [],
      currentIndex: -1,
      currentSong: null,
      isPlaying: false,
      krcLyrics: null,
      isKrcLyricsLoading: false,
      krcLyricsError: null,
    }),

  moveInPlaylist: (fromIndex, toIndex) => {
    set((state) => {
      const newPlaylist = [...state.playlist];
      const [movedSong] = newPlaylist.splice(fromIndex, 1);
      newPlaylist.splice(toIndex, 0, movedSong);

      let newCurrentIndex = state.currentIndex;
      if (fromIndex === state.currentIndex) {
        newCurrentIndex = toIndex;
      } else if (
        fromIndex < state.currentIndex &&
        toIndex >= state.currentIndex
      ) {
        newCurrentIndex = state.currentIndex - 1;
      } else if (
        fromIndex > state.currentIndex &&
        toIndex <= state.currentIndex
      ) {
        newCurrentIndex = state.currentIndex + 1;
      }

      return {
        playlist: newPlaylist,
        currentIndex: newCurrentIndex,
      };
    });
  },

  _getNextIndex: () => {
    const { currentIndex, playlist, playMode } = get();
    if (playlist.length === 0) return -1;

    switch (playMode) {
      case "order":
        return (currentIndex + 1) % playlist.length;
      case "random":
        if (playlist.length === 1) return 0;
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * playlist.length);
        } while (randomIndex === currentIndex);
        return randomIndex;
      case "loop":
        return currentIndex;
      default:
        return currentIndex + 1 < playlist.length ? currentIndex + 1 : -1;
    }
  },

  _getPreviousIndex: () => {
    const { currentIndex, playlist, playMode } = get();
    if (playlist.length === 0) return -1;

    switch (playMode) {
      case "order":
        return currentIndex - 1 >= 0 ? currentIndex - 1 : playlist.length - 1;
      case "random":
        if (playlist.length === 1) return 0;
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * playlist.length);
        } while (randomIndex === currentIndex);
        return randomIndex;
      case "loop":
        return currentIndex;
      default:
        return currentIndex - 1 >= 0 ? currentIndex - 1 : -1;
    }
  },
});
