import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { toast } from "sonner";

import musicApi from "@/lib/api/client";
import { getAudioUrl } from "@/lib/utils/audio-url";

import type { PlayerStoreState } from "./types";
import type { Song } from "@/lib/types/music";
import type { AudioQuality } from "@/lib/api/types";

import { createPlaybackSlice } from "./playback";
import { createPlaylistSlice } from "./playlist";
import { createQualitySlice } from "./quality";
import { createLyricSlice } from "./lyric";
import { createUISlice } from "./ui";

export const usePlayerStore = create<PlayerStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get, api) => ({
        ...createPlaybackSlice(set, get, api),
        ...createPlaylistSlice(set, get, api),
        ...createQualitySlice(set, get, api),
        ...createLyricSlice(set, get, api),
        ...createUISlice(set, get, api),

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
          try {
            const state = get();
            const useQuality = quality || state.currentQuality;

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
                  currentQuality: useQuality,
                  isPlaying: false,
                  showPlayer: true,
                  currentTime: 0,
                  duration: song.duration || 0,
                };
              } else {
                return {
                  currentSong: song,
                  currentIndex: index,
                  currentQuality: useQuality,
                  isPlaying: false,
                  showPlayer: true,
                  currentTime: 0,
                  duration: song.duration || 0,
                };
              }
            });

            const url = await getAudioUrl(
              { ...song, url: undefined },
              useQuality
            );
            const songWithUrl = { ...song, url };

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
                };
              } else {
                const newPlaylist = [...state.playlist];
                newPlaylist[index] = songWithUrl;

                return {
                  playlist: newPlaylist,
                  currentSong: songWithUrl,
                  currentIndex: index,
                  isPlaying: true,
                };
              }
            });

            get().fetchKrcLyrics(true);
          } catch (error) {
            console.error("播放歌曲失败:", error);
            toast.error(`播放 ${song.title} 失败，请检查网络或稍后重试`);
            set({
              krcLyrics: null,
              isKrcLyricsLoading: false,
              krcLyricsError: "播放失败，无法获取歌词",
            });
          }
        },

        switchQuality: async (quality: AudioQuality) => {
          const { currentSong, currentTime, isPlaying } = get();
          if (!currentSong) return;

          const savedTime = currentTime;
          const wasPlaying = isPlaying;

          set({ currentQuality: quality, isPlaying: false });

          try {
            const tempSong = { ...currentSong, url: undefined };
            const newUrl = await getAudioUrl(tempSong, quality);
            const updatedSong = { ...currentSong, url: newUrl };

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

            toast.success(
              `音质已切换到${
                quality === "320"
                  ? "高品音质"
                  : quality === "flac"
                  ? "无损音质"
                  : quality
              }`,
              { duration: 2000 }
            );
          } catch (error) {
            console.error("❌ 切换音质失败:", error);
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            if (
              errorMessage.includes("降级") ||
              errorMessage.includes("fallback")
            ) {
              console.log(`ℹ️ 音质自动降级通知: ${errorMessage}`);
            } else {
              console.log("🔄 发生错误，恢复原播放状态");
              set({ isPlaying: wasPlaying });
              toast.error(`音质切换失败: ${errorMessage}`, { duration: 3000 });
            }
          }
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
