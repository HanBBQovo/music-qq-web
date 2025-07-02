import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { Song, PlayMode } from "../types/music";
import type { AudioQuality, LyricLine } from "../api/types";
import { getAudioUrl } from "../utils/audio-url";
import { toast } from "sonner";
import musicApi from "../api/client";

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

  // KRC歌词状态
  krcLyrics: LyricLine[] | null;
  isKrcLyricsLoading: boolean;
  krcLyricsError: string | null;

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

  // KRC歌词获取
  fetchKrcLyrics: (force?: boolean) => Promise<void>;

  // UI 控制
  setShowPlayer: (show: boolean) => void;
  setShowPlaylist: (show: boolean) => void;

  // 内部辅助方法
  _getNextIndex: () => number;
  _getPreviousIndex: () => number;
}

// 创建播放器状态管理
export const usePlayerStore = create<PlayerState>()(
  subscribeWithSelector(
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

        // KRC歌词初始状态
        krcLyrics: null,
        isKrcLyricsLoading: false,
        krcLyricsError: null,

        // 播放控制方法
        play: () => set({ isPlaying: true }),
        pause: () => set({ isPlaying: false }),
        togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
        setVolume: (volume) =>
          set({ volume: Math.max(0, Math.min(1, volume)) }),
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
                krcLyrics: null,
                isKrcLyricsLoading: false,
                krcLyricsError: null,
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
                krcLyrics: null,
                isKrcLyricsLoading: false,
                krcLyricsError: null,
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
                    krcLyrics: null,
                    isKrcLyricsLoading: false,
                    krcLyricsError: null,
                  };
                }
              }

              // 如果找不到当前歌曲，fallback到第一首
              return {
                playlist: newPlaylist,
                currentIndex: newPlaylist.length > 0 ? 0 : -1,
                currentSong: newPlaylist.length > 0 ? newPlaylist[0] : null,
                isPlaying: false,
                krcLyrics: null,
                isKrcLyricsLoading: false,
                krcLyricsError: null,
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

            // 每次切歌都重新获取URL以确保通过HEAD验证流程
            let songWithUrl = song;

            // 强制重新获取URL，因为存储的可能只是构建的API路径，需要HEAD验证
            const url = await getAudioUrl(
              { ...song, url: undefined },
              useQuality
            );
            songWithUrl = { ...song, url };

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

            // 自动获取歌词
            get().fetchKrcLyrics(true);
          } catch (error) {
            console.error("播放歌曲失败:", error);
            toast.error(`播放 ${song.title} 失败，请检查网络或稍后重试`);
            // 播放失败也需要清除loading状态
            set({
              krcLyrics: null,
              isKrcLyricsLoading: false,
              krcLyricsError: "播放失败，无法获取歌词",
            });
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
            // 创建临时歌曲对象，移除现有URL强制重新获取
            const tempSong = { ...currentSong, url: undefined };
            const newUrl = await getAudioUrl(tempSong, quality);

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

        // 获取KRC歌词
        fetchKrcLyrics: async (force = false) => {
          const { currentSong, krcLyrics, isKrcLyricsLoading } = get();

          // 如果没有当前歌曲，或正在加载，或非强制模式下已有歌词，则不执行
          if (
            !currentSong ||
            isKrcLyricsLoading ||
            (!force && krcLyrics && krcLyrics.length > 0)
          ) {
            return;
          }

          set({ isKrcLyricsLoading: true, krcLyricsError: null });

          try {
            const res = await musicApi.getLyric({
              id: currentSong.id,
              mid: currentSong.mid,
              format: "krc",
            });

            if (res.data.krcData && res.data.krcData.lines) {
              const processedLines = res.data.krcData.lines.map((line) => ({
                ...line,
                words: line.words.map((word) => ({
                  ...word,
                  text: word.text === " " ? "\u00a0" : word.text,
                })),
              }));
              set({ krcLyrics: processedLines, isKrcLyricsLoading: false });
            } else {
              set({
                krcLyricsError: "没有可用的逐字歌词",
                isKrcLyricsLoading: false,
                krcLyrics: [],
              });
            }
          } catch (err) {
            console.error("获取KRC歌词失败:", err);
            set({
              krcLyricsError: "无法加载歌词",
              isKrcLyricsLoading: false,
              krcLyrics: [],
            });
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

          // 获取Cookie或Cookie池设置
          const settings = localStorage.getItem("settings-store");
          let useCookiePool = false;
          let selectedCookieId = "";

          if (settings) {
            try {
              const parsedSettings = JSON.parse(settings);
              useCookiePool = parsedSettings.state?.useCookiePool || false;
              selectedCookieId = useCookiePool
                ? parsedSettings.state?.selectedCookieId || ""
                : "";
            } catch (error) {
              console.error("解析设置失败:", error);
            }
          }

          // 使用与audio-url.ts相同的API路径构造逻辑
          const API_BASE_URL =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
          let streamUrl;

          // 如果BASE_URL是相对路径（如/music-api），需要特殊处理
          if (API_BASE_URL === "/music-api") {
            if (typeof window !== "undefined") {
              // 客户端环境，使用完整URL
              streamUrl = `${
                window.location.origin
              }/music-api/api/play/stream?mid=${encodeURIComponent(
                mid
              )}&quality=${
                state.currentQuality
              }&autoFallback=true&redirect=true`;
            } else {
              // 服务器端渲染环境
              streamUrl = `/music-api/api/play/stream?mid=${encodeURIComponent(
                mid
              )}&quality=${
                state.currentQuality
              }&autoFallback=true&redirect=true`;
            }
          }
          // 处理标准开发环境（完整URL）
          else if (
            API_BASE_URL &&
            (API_BASE_URL.includes("://") || API_BASE_URL.startsWith("http"))
          ) {
            // BASE_URL是完整URL
            streamUrl = `${API_BASE_URL}/api/play/stream?mid=${encodeURIComponent(
              mid
            )}&quality=${state.currentQuality}&autoFallback=true&redirect=true`;
          }
          // 处理其他情况
          else {
            if (typeof window !== "undefined") {
              // 客户端环境，使用当前域名
              streamUrl = `${
                window.location.origin
              }/api/play/stream?mid=${encodeURIComponent(mid)}&quality=${
                state.currentQuality
              }&autoFallback=true&redirect=true`;
            } else {
              // 服务器端渲染环境
              streamUrl = `/api/play/stream?mid=${encodeURIComponent(
                mid
              )}&quality=${
                state.currentQuality
              }&autoFallback=true&redirect=true`;
            }
          }

          // 在URL中添加cookie_id参数（如果使用Cookie池）
          if (useCookiePool && selectedCookieId) {
            streamUrl += `&cookie_id=${encodeURIComponent(selectedCookieId)}`;
          }

          // 构建请求头 - 只有在不使用Cookie池时才发送cookie头
          const headers: Record<string, string> = {
            Range: "bytes=0-1023",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          };

          // 只有在不使用Cookie池时才添加cookie头
          if (!useCookiePool) {
            const storedCookie = localStorage.getItem("music_cookie") || "";
            if (storedCookie) {
              headers["x-qq-cookie"] = storedCookie;
            }
          }

          const response = await fetch(streamUrl, {
            method: "HEAD",
            headers: headers,
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

    if (isMatch) {
      // 更新当前音质状态
      usePlayerStore.setState({ currentQuality: actualQuality });

      // 清理并处理降级原因
      const cleanReason = cleanFallbackReason(fallbackReason);

      // 显示降级提示
      toast.warning(
        `音质已自动降级：${getQualityDisplayName(
          requestedQuality
        )} → ${getQualityDisplayName(actualQuality)}`,
        {
          description: cleanReason,
          duration: 3000,
        }
      );
    }
  });

  // 监听音质信息更新事件
  window.addEventListener("quality-info-updated", (event: any) => {
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

    if (isMatch) {
      // 更新音质信息
      usePlayerStore.setState({
        availableQualities: qualityInfo.availableQualities,
        qualitySizes: qualityInfo.qualitySizes,
        recommendedQuality: qualityInfo.recommendedQuality,
      });
    }
  });
}

// 获取音质显示名称
function getQualityDisplayName(quality: string): string {
  switch (quality) {
    case "128":
      return "标准音质";
    case "320":
      return "高品音质";
    case "flac":
      return "无损音质";
    case "ATMOS_2":
      return "臻品全景声2.0";
    case "ATMOS_51":
      return "臻品音质2.0";
    case "MASTER":
      return "臻品母带2.0";
    default:
      return quality;
  }
}

// 清理降级原因，避免显示编码内容
function cleanFallbackReason(reason: string | null): string {
  if (!reason) return "请求的音质不可用";

  // 检查是否是base64编码（简单检测）
  if (reason.length > 50 && /^[A-Za-z0-9+/]+=*$/.test(reason)) {
    try {
      // 尝试解码base64
      const decoded = atob(reason);

      // 尝试处理UTF-8编码的中文内容
      try {
        // 将解码的字节序列转换为正确的UTF-8字符串
        const utf8Decoded = decodeURIComponent(escape(decoded));
        if (utf8Decoded && utf8Decoded.length > 0 && utf8Decoded !== decoded) {
          reason = utf8Decoded;
        } else {
          // 如果UTF-8解码没有改变内容，检查是否是可读的ASCII
          if (decoded && /^[\x20-\x7E\s]*$/.test(decoded)) {
            reason = decoded;
          } else {
            // 无法解码，使用默认消息
            return "音质资源不可用，已自动降级";
          }
        }
      } catch (utf8Error) {
        // UTF-8解码失败，尝试直接使用base64解码结果
        if (decoded && /^[\x20-\x7E\s]*$/.test(decoded)) {
          reason = decoded;
        } else {
          return "音质资源不可用，已自动降级";
        }
      }
    } catch (e) {
      // 解码失败，使用默认消息
      return "音质资源不可用，已自动降级";
    }
  }

  // 清理HTML实体和特殊字符
  let cleaned = reason
    .replace(/&#\d+;/g, "") // 移除数字HTML实体
    .replace(/&[^;]+;/g, "") // 移除其他HTML实体
    .replace(/<[^>]*>/g, "") // 移除HTML标签
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // 移除控制字符
    .trim();

  // 如果清理后太长，截断并添加省略号
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 97) + "...";
  }

  // 如果清理后为空或太短，使用默认消息
  if (!cleaned || cleaned.length < 3) {
    return "音质资源不可用，已自动降级";
  }

  return cleaned;
}
