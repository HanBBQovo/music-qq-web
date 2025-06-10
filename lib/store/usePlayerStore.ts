import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Song, PlayMode } from "../types/music";
import type { AudioQuality } from "../api/types";
import { getAudioUrl } from "../utils/audio-url";
import { toast } from "sonner";

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

  // 音质设置
  currentQuality: AudioQuality;
  setCurrentQuality: (quality: AudioQuality) => Promise<void>;
  switchQuality: (quality: AudioQuality) => Promise<void>;

  // 音质信息
  availableQualities: AudioQuality[]; // 当前歌曲可用的音质列表
  qualitySizes: Record<string, number>; // 各音质的文件大小（字节）
  recommendedQuality: AudioQuality | null; // 推荐音质

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
  playSong: (song: Song, quality?: AudioQuality) => Promise<void>;
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
      currentQuality: "320" as AudioQuality, // 默认音质

      // 音质信息初始状态
      availableQualities: [],
      qualitySizes: {},
      recommendedQuality: null,

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
        const state = get();
        const wasPlayingRemovedSong = index === state.currentIndex;
        const wasPlaying = state.isPlaying;

        set((currentState) => {
          const newPlaylist = currentState.playlist.filter(
            (_, i) => i !== index
          );

          // 如果播放列表为空，清空所有状态
          if (newPlaylist.length === 0) {
            return {
              playlist: [],
              currentIndex: -1,
              currentSong: null,
              isPlaying: false,
            };
          }

          if (index === currentState.currentIndex) {
            // 移除的是正在播放的歌曲，需要智能切换
            let newCurrentIndex = -1;
            let newCurrentSong = null;

            if (index < newPlaylist.length) {
              // 如果删除的不是最后一首，切换到原来的下一首（现在在相同位置）
              newCurrentIndex = index;
              newCurrentSong = newPlaylist[index];
            } else if (newPlaylist.length > 0) {
              // 如果删除的是最后一首，切换到新的最后一首
              newCurrentIndex = newPlaylist.length - 1;
              newCurrentSong = newPlaylist[newCurrentIndex];
            }

            return {
              playlist: newPlaylist,
              currentIndex: newCurrentIndex,
              currentSong: newCurrentSong,
              isPlaying: false, // 停止播放，等待后续自动播放新歌曲
            };
          } else {
            // 删除的不是当前播放的歌曲，需要在新播放列表中重新查找当前歌曲
            const currentSongIdentifier =
              currentState.currentSong?.id || currentState.currentSong?.mid;

            if (currentSongIdentifier) {
              const newCurrentIndex = newPlaylist.findIndex(
                (song) =>
                  song.id === currentSongIdentifier ||
                  song.mid === currentSongIdentifier
              );

              if (newCurrentIndex >= 0) {
                // 找到了，继续播放当前歌曲
                return {
                  playlist: newPlaylist,
                  currentIndex: newCurrentIndex,
                  currentSong: currentState.currentSong, // 保持当前歌曲对象引用不变
                  isPlaying: currentState.isPlaying, // 保持播放状态不变
                };
              }
            }

            // 如果找不到当前歌曲，fallback到第一首
            return {
              playlist: newPlaylist,
              currentIndex: newPlaylist.length > 0 ? 0 : -1,
              currentSong: newPlaylist.length > 0 ? newPlaylist[0] : null,
              isPlaying: false,
            };
          }
        });

        // 只有在删除当前播放歌曲时才自动播放新歌曲
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
      playSong: async (song, quality) => {
        try {
          const state = get();
          const useQuality = quality || state.currentQuality;

          // 先设置基本歌曲信息，确保事件能匹配到
          set((state) => {
            let index = state.playlist.findIndex(
              (s) => s.mid === song.mid || s.id === song.id
            );

            if (index === -1) {
              const newPlaylist = [...state.playlist, song];
              index = newPlaylist.length - 1;

              return {
                playlist: newPlaylist,
                currentSong: song, // 先设置歌曲信息
                currentIndex: index,
                currentQuality: useQuality,
                isPlaying: false, // 暂时不播放，等URL获取完成
                showPlayer: true,
                currentTime: 0,
                duration: song.duration || 0,
              };
            } else {
              return {
                currentSong: song, // 先设置歌曲信息
                currentIndex: index,
                currentQuality: useQuality,
                isPlaying: false, // 暂时不播放，等URL获取完成
                showPlayer: true,
                currentTime: 0,
                duration: song.duration || 0,
              };
            }
          });

          // 然后获取音频URL（如果没有）
          let songWithUrl = song;
          if (!song.url) {
            const url = await getAudioUrl(song, useQuality);
            songWithUrl = { ...song, url };
          }

          // 最后更新URL并开始播放
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
                isPlaying: true, // 现在开始播放
              };
            } else {
              // 更新播放列表中的歌曲URL
              const newPlaylist = [...state.playlist];
              newPlaylist[index] = songWithUrl;

              return {
                playlist: newPlaylist,
                currentSong: songWithUrl,
                currentIndex: index,
                isPlaying: true, // 现在开始播放
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

      // 音质控制方法
      setCurrentQuality: async (quality) => {
        set({ currentQuality: quality });
      },

      switchQuality: async (quality: AudioQuality) => {
        const { currentSong, currentTime, isPlaying } = get();
        if (!currentSong) return;

        console.log(
          `🔄 正在切换音质: ${
            get().currentQuality
          } -> ${quality}, 当前时间: ${currentTime.toFixed(2)}s`
        );

        // 1. 保存当前播放状态和时间
        const savedTime = currentTime;
        const wasPlaying = isPlaying;

        // 2. 立即暂停播放并更新目标音质状态
        set({
          currentQuality: quality,
          isPlaying: false, // 立即暂停，避免听到从头开始的声音
        });

        // 3. 获取新音质的URL
        try {
          console.log(`📡 正在获取新音质(${quality})的URL...`);

          // 创建临时歌曲对象，移除现有URL强制重新获取
          const tempSong = { ...currentSong, url: undefined };
          const newUrl = await getAudioUrl(tempSong, quality);
          console.log(`✅ 成功获取新音质URL:`, newUrl.substring(0, 80) + "...");

          // 4. 创建更新的歌曲对象
          const updatedSong = {
            ...currentSong,
            url: newUrl,
          };

          // 5. 更新歌曲和时间，但保持暂停状态
          set({
            currentSong: updatedSong,
            currentTime: savedTime, // 保持播放位置
            isPlaying: false, // 继续保持暂停状态
          });

          // 6. 设置一个标识，告诉useAudioPlayer这是音质切换场景
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("quality-switch", {
                detail: {
                  songId: currentSong.mid || currentSong.id,
                  targetTime: savedTime,
                  shouldResumePlayback: wasPlaying,
                },
              })
            );
          }

          // 7. 显示成功提示
          toast.success(
            `音质已切换到${
              quality === "320"
                ? "高品音质"
                : quality === "flac"
                ? "无损音质"
                : quality
            }`,
            {
              duration: 2000,
            }
          );
        } catch (error) {
          console.error(`❌ 切换音质失败:`, error);

          // 检查是否是音质降级相关的"错误"
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes("降级") ||
            errorMessage.includes("fallback")
          ) {
            // 这实际上不是错误，而是音质降级通知
            console.log(`ℹ️ 音质自动降级通知: ${errorMessage}`);
          } else {
            // 真正的错误：恢复原播放状态
            console.log(`🔄 发生错误，恢复原播放状态`);
            set({ isPlaying: wasPlaying });

            toast.error(`音质切换失败: ${errorMessage}`, {
              duration: 3000,
            });
          }
        }
      },
    }),
    {
      name: "music-player-storage",
      partialize: (state) => ({
        volume: state.volume,
        playMode: state.playMode,
        currentQuality: state.currentQuality,
        playlist: state.playlist,
        currentIndex: state.currentIndex,
        currentSong: state.currentSong,
      }),
    }
  )
);

// 在浏览器环境中设置音质降级事件监听器
if (typeof window !== "undefined") {
  // 页面加载完成后，检查是否有当前歌曲需要恢复音质信息
  setTimeout(() => {
    const state = usePlayerStore.getState();
    if (
      state.currentSong &&
      (!state.availableQualities || state.availableQualities.length === 0)
    ) {
      console.log("🔄 页面刷新后恢复音质信息:", state.currentSong.title);

      // 重新获取当前歌曲的音质信息
      const restoreQualityInfo = async () => {
        try {
          // 创建一个HEAD请求来获取音质信息，而不实际下载音频
          const mid = state.currentSong?.mid || state.currentSong?.id;
          if (!mid) return;

          const API_BASE_URL =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
          const streamUrl = `${API_BASE_URL}/api/play/stream?mid=${encodeURIComponent(
            mid
          )}&quality=${state.currentQuality}&autoFallback=true`;

          const response = await fetch(streamUrl, {
            method: "HEAD",
            headers: {
              "x-qq-cookie": localStorage.getItem("qqmusic_cookie") || "",
              Range: "bytes=0-1023",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          if (response.ok) {
            // 使用现有的parseQualityInfo函数解析响应头
            const { parseQualityInfo } = await import("@/lib/utils/audio-url");
            const qualityInfo = parseQualityInfo(response);

            // 直接更新状态
            usePlayerStore.setState({
              availableQualities: qualityInfo.availableQualities,
              qualitySizes: qualityInfo.qualitySizes,
              recommendedQuality: qualityInfo.recommendedQuality,
            });

            console.log("✅ 成功恢复音质信息:", qualityInfo);
          }
        } catch (error) {
          console.warn("⚠️ 恢复音质信息失败:", error);
        }
      };

      restoreQualityInfo();
    }
  }, 1000); // 延迟1秒确保应用完全加载

  window.addEventListener("quality-fallback", (event: any) => {
    const { songId, actualQuality, requestedQuality, fallbackReason } =
      event.detail;

    // 检查是否是当前播放的歌曲（简单mid匹配）
    const state = usePlayerStore.getState();
    const currentSong = state.currentSong;

    if (!currentSong) {
      return;
    }

    // 简单匹配：使用mid或id
    const currentIdentifier = currentSong.mid || currentSong.id;
    const isMatch = currentIdentifier === songId;

    console.log("🔍 音质降级匹配:", {
      eventSongId: songId,
      currentIdentifier: currentIdentifier,
      isMatch: isMatch,
    });

    if (isMatch) {
      console.log(
        `🔊 音质自动降级: ${requestedQuality} -> ${actualQuality}, 原因: ${fallbackReason}`
      );

      // 更新当前音质状态
      usePlayerStore.setState({ currentQuality: actualQuality });

      // 显示降级提示
      toast.warning(`音质已自动降级到${actualQuality}`, {
        duration: 3000,
      });
    }
  });

  // 监听音质信息更新事件
  window.addEventListener("quality-info-updated", (event: any) => {
    console.log("📡 收到 quality-info-updated 事件:", event.detail);
    const { songId, qualityInfo } = event.detail;

    // 检查是否是当前播放的歌曲（简单mid匹配）
    const state = usePlayerStore.getState();
    const currentSong = state.currentSong;

    if (!currentSong) {
      return;
    }

    // 简单匹配：使用mid或id
    const currentIdentifier = currentSong.mid || currentSong.id;
    const isMatch = currentIdentifier === songId;

    console.log("🔍 音质信息匹配:", {
      eventSongId: songId,
      currentIdentifier: currentIdentifier,
      isMatch: isMatch,
    });

    if (isMatch) {
      console.log(`📊 音质信息更新成功:`, qualityInfo);

      // 更新音质信息
      usePlayerStore.setState({
        availableQualities: qualityInfo.availableQualities,
        qualitySizes: qualityInfo.qualitySizes,
        recommendedQuality: qualityInfo.recommendedQuality,
      });
    } else {
      console.log("❌ 歌曲不匹配，跳过音质信息更新");
    }
  });
}
