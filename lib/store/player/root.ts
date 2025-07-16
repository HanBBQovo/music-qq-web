import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { toast } from "sonner";

import musicApi from "@/lib/api/client";
import { getAudioUrl } from "@/lib/utils/audio-url";
import { withErrorHandling } from "@/lib/utils/error";

import type { PlayerStoreState } from "./types";
import type { Song } from "@/lib/types/music";
import type { AudioQuality } from "@/lib/api/types";

import { createPlaybackSlice } from "./playback";
import { createPlaylistSlice } from "./playlist";
import { createQualitySlice } from "./quality";
import { createLyricSlice } from "./lyric";
import { createUISlice } from "./ui";
import { createNotificationSlice } from "../notification";
import { NotificationSlice } from "../notification";

export const usePlayerStore = create<PlayerStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get, api) => ({
        ...createPlaybackSlice(set, get, api),
        ...createPlaylistSlice(set, get, api),
        ...createQualitySlice(set, get, api),
        ...createLyricSlice(set, get, api),
        ...createUISlice(set, get, api),
        ...createNotificationSlice(set, get, api),

        playSongList: async (songs, startIndex = 0) => {
          if (songs.length === 0) return;

          const actualStartIndex = startIndex < songs.length ? startIndex : 0;
          const startSong = songs[actualStartIndex];

          set({
            playlist: songs,
            currentSong: startSong,
            currentIndex: actualStartIndex,
            showPlayer: true,
          });

          await get().playSong(startSong);
        },

        playSong: async (song, quality) => {
          // 1. 立即更新UI，显示歌曲信息，准备播放
          const state = get();
          const useQuality = quality || state.currentQuality;
          let songIndex = state.playlist.findIndex(
            (s) => s.mid === song.mid || s.id === song.id
          );

          if (songIndex === -1) {
            const newPlaylist = [...state.playlist, song];
            songIndex = newPlaylist.length - 1;

            set({
              playlist: newPlaylist,
              currentSong: song,
              currentIndex: songIndex,
              currentQuality: useQuality,
              isPlaying: false,
              showPlayer: true,
              currentTime: 0,
              duration: song.duration || 0,
            });
          } else {
            set({
              currentSong: song,
              currentIndex: songIndex,
              currentQuality: useQuality,
              isPlaying: false,
              showPlayer: true,
              currentTime: 0,
              duration: song.duration || 0,
            });
          }

          // ★ 立即开始获取歌词，与获取播放URL并行
          get().fetchKrcLyrics(true);

          // 2. 异步获取播放URL并处理结果
          await withErrorHandling({
            apiCall: () => getAudioUrl({ ...song, url: undefined }, useQuality),
            onSuccess: (url) => {
              const songWithUrl = { ...song, url };
              set((currentState) => {
                const newPlaylist = [...currentState.playlist];
                let currentIndex = currentState.playlist.findIndex(
                  (s) => s.mid === song.mid || s.id === song.id
                );
                if (currentIndex === -1) {
                  // 理论上不会发生，因为前面已经加进去了
                  currentIndex = newPlaylist.length;
                  newPlaylist.push(songWithUrl);
                } else {
                  newPlaylist[currentIndex] = songWithUrl;
                }

                return {
                  playlist: newPlaylist,
                  currentSong: songWithUrl,
                  currentIndex: currentIndex,
                  isPlaying: true, // 获取到URL后才真正开始播放
                };
              });

              // get().fetchKrcLyrics(true); // ★ 从此处移动
            },
            onError: () => {
              // 错误toast由withErrorHandling处理
              set({
                // 可以选择在这里设置一个错误状态，或者让播放器停留在isPlaing: false的状态
                isPlaying: false,
                krcLyricsError: "播放失败，无法获取歌词",
              });
            },
            errorMessage: `播放 ${song.title} 失败`,
          });
        },

        switchQuality: async (quality: AudioQuality) => {
          const { currentSong, currentTime, isPlaying } = get();
          if (!currentSong) return;

          const savedTime = currentTime;
          const wasPlaying = isPlaying;

          set({ currentQuality: quality, isPlaying: false });

          await withErrorHandling({
            apiCall: async () => {
              const tempSong = { ...currentSong, url: undefined };
              const newUrl = await getAudioUrl(tempSong, quality);
              return { ...currentSong, url: newUrl };
            },
            onSuccess: (updatedSong) => {
              set({
                currentSong: updatedSong,
                currentTime: savedTime,
                isPlaying: false,
              });

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

              toast.success(`音质已切换到${getQualityDisplayName(quality)}`, {
                duration: 2000,
              });
            },
            onError: (error) => {
              if (
                error.message.includes("降级") ||
                error.message.includes("fallback")
              ) {
                console.log(`ℹ️ 音质自动降级通知: ${error.message}`);
              } else {
                console.log("🔄 发生错误，恢复原播放状态");
                set({ isPlaying: wasPlaying });
                // toast 在 withErrorHandling 中处理
              }
            },
            errorMessage: `音质切换失败`,
          });
        },

        fetchKrcLyrics: async (force = false) => {
          const { currentSong, krcLyrics, isKrcLyricsLoading } = get();

          if (
            !currentSong ||
            isKrcLyricsLoading ||
            (!force && krcLyrics && krcLyrics.length > 0)
          ) {
            return;
          }

          set({ isKrcLyricsLoading: true, krcLyricsError: null });

          await withErrorHandling({
            apiCall: () =>
              musicApi.getLyric({
                id: currentSong.id,
                mid: currentSong.mid,
                format: "krc",
              }),
            onSuccess: (res) => {
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
            },
            onError: () => {
              set({
                krcLyricsError: "无法加载歌词",
                isKrcLyricsLoading: false,
                krcLyrics: [],
              });
            },
            errorMessage: "获取KRC歌词失败",
            showToast: false,
          });
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
          qualitySizes: state.qualitySizes,
          availableQualities: state.availableQualities,
          recommendedQuality: state.recommendedQuality,
        }),
      }
    )
  )
);

if (typeof window !== "undefined") {
  window.addEventListener("quality-info-updated", (event: any) => {
    const { songId, qualityInfo } = event.detail;

    const state = usePlayerStore.getState();
    const currentSong = state.currentSong;
    if (!currentSong) return;

    const currentIdentifier = currentSong.mid || currentSong.id;
    if (currentIdentifier === songId) {
      usePlayerStore.setState({
        availableQualities: qualityInfo.availableQualities,
        qualitySizes: qualityInfo.qualitySizes,
        recommendedQuality: qualityInfo.recommendedQuality,
      });
    }
  });

  window.addEventListener("quality-fallback", (event: any) => {
    const { songId, actualQuality, requestedQuality, fallbackReason } =
      event.detail;

    const state = usePlayerStore.getState();
    const currentSong = state.currentSong;

    if (!currentSong) return;

    const currentIdentifier = currentSong.mid || currentSong.id;
    if (currentIdentifier === songId) {
      usePlayerStore.setState({ currentQuality: actualQuality });

      const cleanReason = cleanFallbackReason(fallbackReason);

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
}

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

function cleanFallbackReason(reason: string | null): string {
  if (!reason) return "请求的音质不可用";

  if (reason.length > 50 && /^[A-Za-z0-9+/]+=*$/.test(reason)) {
    try {
      const decoded = atob(reason);
      try {
        const utf8Decoded = decodeURIComponent(escape(decoded));
        if (utf8Decoded && utf8Decoded.length > 0 && utf8Decoded !== decoded) {
          reason = utf8Decoded;
        } else {
          if (decoded && /^[\x20-\x7E\s]*$/.test(decoded)) {
            reason = decoded;
          } else {
            return "音质资源不可用，已自动降级";
          }
        }
      } catch (utf8Error) {
        if (decoded && /^[\x20-\x7E\s]*$/.test(decoded)) {
          reason = decoded;
        } else {
          return "音质资源不可用，已自动降级";
        }
      }
    } catch (e) {
      return "音质资源不可用，已自动降级";
    }
  }

  let cleaned = reason
    .replace(/&#\d+;/g, "")
    .replace(/&[^;]+;/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .trim();

  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 97) + "...";
  }

  if (!cleaned || cleaned.length < 3) {
    return "音质资源不可用，已自动降级";
  }

  return cleaned;
}
