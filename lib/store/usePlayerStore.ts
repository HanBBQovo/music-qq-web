import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Song, PlayMode } from "../types/music";
import { getAudioUrl } from "../utils/audio-url";

// 播放器状态接口
interface PlayerState {
  // 播放控制状态
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;

  // 当前播放信息
  currentSong: Song | null;
  currentIndex: number;

  // 播放列表
  playlist: Song[];
  playMode: PlayMode;

  // UI 状态
  showPlayer: boolean;
  showPlaylist: boolean;

  // 播放控制方法
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;

  // 播放列表控制
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  playAtIndex: (index: number) => Promise<void>;
  setPlayMode: (mode: PlayMode) => void;

  // 播放列表管理
  addToPlaylist: (song: Song) => void;
  addMultipleToPlaylist: (songs: Song[]) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
  moveInPlaylist: (fromIndex: number, toIndex: number) => void;

  // 播放歌曲
  playSong: (song: Song) => Promise<void>;
  playSongList: (songs: Song[], startIndex?: number) => Promise<void>;

  // UI 控制
  setShowPlayer: (show: boolean) => void;
  setShowPlaylist: (show: boolean) => void;

  // 内部辅助方法
  _getNextIndex: () => number;
  _getPreviousIndex: () => number;
}

// 创建播放器状态管理
export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isPlaying: false,
      volume: 0.8,
      currentTime: 0,
      duration: 0,
      currentSong: null,
      currentIndex: -1,
      playlist: [],
      playMode: "order",
      showPlayer: false,
      showPlaylist: false,

      // 播放控制方法
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setCurrentTime: (currentTime) => set({ currentTime }),
      setDuration: (duration) => set({ duration }),

      // 播放列表控制
      playNext: async () => {
        const state = get();
        const nextIndex = state._getNextIndex();
        if (nextIndex >= 0 && nextIndex < state.playlist.length) {
          const nextSong = state.playlist[nextIndex];
          await state.playSong(nextSong);
        }
      },

      playPrevious: async () => {
        const state = get();
        const prevIndex = state._getPreviousIndex();
        if (prevIndex >= 0 && prevIndex < state.playlist.length) {
          const prevSong = state.playlist[prevIndex];
          await state.playSong(prevSong);
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

      // 播放列表管理
      addToPlaylist: (song) => {
        set((state) => {
          const exists = state.playlist.find(
            (s) => s.mid === song.mid || s.id === song.id
          );
          if (!exists) {
            return { playlist: [...state.playlist, song] };
          }
          return state;
        });
      },

      addMultipleToPlaylist: (songs) => {
        set((state) => {
          const newSongs = songs.filter(
            (song) =>
              !state.playlist.find(
                (s) => s.mid === song.mid || s.id === song.id
              )
          );
          return { playlist: [...state.playlist, ...newSongs] };
        });
      },

      removeFromPlaylist: (index) => {
        set((state) => {
          const newPlaylist = state.playlist.filter((_, i) => i !== index);
          let newCurrentIndex = state.currentIndex;

          if (index === state.currentIndex) {
            newCurrentIndex = -1;
          } else if (index < state.currentIndex) {
            newCurrentIndex = state.currentIndex - 1;
          }

          return {
            playlist: newPlaylist,
            currentIndex: newCurrentIndex,
            currentSong:
              newCurrentIndex >= 0 ? newPlaylist[newCurrentIndex] : null,
          };
        });
      },

      clearPlaylist: () =>
        set({
          playlist: [],
          currentIndex: -1,
          currentSong: null,
          isPlaying: false,
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

      playSongList: async (songs, startIndex = 0) => {
        if (songs.length === 0) return;

        const actualStartIndex = startIndex < songs.length ? startIndex : 0;
        const startSong = songs[actualStartIndex];

        try {
          // 获取第一首歌的URL
          let startSongWithUrl = startSong;
          if (!startSong.url) {
            const url = await getAudioUrl(startSong);
            startSongWithUrl = { ...startSong, url };
          }

          set({
            playlist: songs,
            currentSong: startSongWithUrl,
            currentIndex: actualStartIndex,
            isPlaying: true,
            showPlayer: true,
            currentTime: 0,
            duration: startSongWithUrl.duration || 0,
          });
        } catch (error) {
          console.error("播放歌单失败:", error);
          // 即使失败也要设置播放列表
          set({
            playlist: songs,
            currentSong: startSong,
            currentIndex: actualStartIndex,
            isPlaying: false,
            showPlayer: true,
            currentTime: 0,
            duration: startSong.duration || 0,
          });
          throw error;
        }
      },

      // 播放歌曲
      playSong: async (song) => {
        try {
          // 获取音频URL（如果没有）
          let songWithUrl = song;
          if (!song.url) {
            const url = await getAudioUrl(song);
            songWithUrl = { ...song, url };
          }

          set((state) => {
            let index = state.playlist.findIndex(
              (s) => s.mid === song.mid || s.id === song.id
            );

            if (index === -1) {
              const newPlaylist = [...state.playlist, songWithUrl];
              index = newPlaylist.length - 1;

              return {
                playlist: newPlaylist,
                currentSong: songWithUrl,
                currentIndex: index,
                isPlaying: true,
                showPlayer: true,
                currentTime: 0,
                duration: songWithUrl.duration || 0,
              };
            } else {
              // 更新播放列表中的歌曲URL
              const newPlaylist = [...state.playlist];
              newPlaylist[index] = songWithUrl;

              return {
                playlist: newPlaylist,
                currentSong: songWithUrl,
                currentIndex: index,
                isPlaying: true,
                showPlayer: true,
                currentTime: 0,
                duration: songWithUrl.duration || 0,
              };
            }
          });
        } catch (error) {
          console.error("播放歌曲失败:", error);
          // 即使获取URL失败，也要设置为当前歌曲但不播放
          set((state) => {
            let index = state.playlist.findIndex(
              (s) => s.mid === song.mid || s.id === song.id
            );
            if (index === -1) {
              const newPlaylist = [...state.playlist, song];
              index = newPlaylist.length - 1;
              return {
                playlist: newPlaylist,
                currentSong: song,
                currentIndex: index,
                isPlaying: false,
                showPlayer: true,
                currentTime: 0,
                duration: song.duration || 0,
              };
            } else {
              return {
                currentSong: song,
                currentIndex: index,
                isPlaying: false,
                showPlayer: true,
                currentTime: 0,
                duration: song.duration || 0,
              };
            }
          });
          throw error;
        }
      },

      // UI 控制
      setShowPlayer: (show) => set({ showPlayer: show }),
      setShowPlaylist: (show) => set({ showPlaylist: show }),

      // 内部辅助方法
      _getNextIndex: () => {
        const state = get();
        const { currentIndex, playlist, playMode } = state;

        if (playlist.length === 0) return -1;

        switch (playMode) {
          case "order":
            return currentIndex + 1 < playlist.length ? currentIndex + 1 : 0;
          case "random":
            return Math.floor(Math.random() * playlist.length);
          case "loop":
            return currentIndex;
          default:
            return currentIndex + 1 < playlist.length ? currentIndex + 1 : -1;
        }
      },

      _getPreviousIndex: () => {
        const state = get();
        const { currentIndex, playlist, playMode } = state;

        if (playlist.length === 0) return -1;

        switch (playMode) {
          case "order":
            return currentIndex - 1 >= 0
              ? currentIndex - 1
              : playlist.length - 1;
          case "random":
            return Math.floor(Math.random() * playlist.length);
          case "loop":
            return currentIndex;
          default:
            return currentIndex - 1 >= 0 ? currentIndex - 1 : -1;
        }
      },
    }),
    {
      name: "music-player-storage",
      partialize: (state) => ({
        volume: state.volume,
        playMode: state.playMode,
        playlist: state.playlist,
        currentIndex: state.currentIndex,
        currentSong: state.currentSong,
      }),
    }
  )
);
