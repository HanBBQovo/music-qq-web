import { useState, useEffect, useCallback, useMemo } from "react";
import { musicApi } from "@/lib/api/client";
import { usePlayerStore } from "@/lib/store/usePlayerStore";

// 歌词行接口
export interface LyricLine {
  time: number; // 时间戳（秒）
  text: string; // 歌词文本
  originalTime: string; // 原始时间格式 [mm:ss.xxx]
}

// 歌词Hook状态
interface LyricsState {
  lyrics: LyricLine[];
  currentLineIndex: number;
  currentLine: LyricLine | null;
  nextLine: LyricLine | null;
  loading: boolean;
  error: string | null;
}

/**
 * 解析LRC格式歌词
 * @param lrcText LRC格式的歌词文本
 * @returns 解析后的歌词行数组
 */
const parseLRC = (lrcText: string): LyricLine[] => {
  if (!lrcText) return [];

  const lines = lrcText.split("\n");
  const lyricLines: LyricLine[] = [];

  for (const line of lines) {
    // 匹配时间标签 [mm:ss.xxx] 或 [mm:ss]
    const timeMatch = line.match(/\[(\d{2}):(\d{2})\.?(\d{0,3})?\]/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      const milliseconds = timeMatch[3]
        ? parseInt(timeMatch[3].padEnd(3, "0"), 10)
        : 0;

      // 转换为总秒数
      const time = minutes * 60 + seconds + milliseconds / 1000;

      // 提取歌词文本（去掉时间标签）
      const text = line.replace(/\[\d{2}:\d{2}\.?\d{0,3}?\]/g, "").trim();

      // 只添加有歌词文本的行
      if (text) {
        lyricLines.push({
          time,
          text,
          originalTime: timeMatch[0],
        });
      }
    }
  }

  // 按时间排序
  lyricLines.sort((a, b) => a.time - b.time);

  return lyricLines;
};

/**
 * 歌词Hook
 * 提供歌词解析、同步和状态管理功能
 */
export const useLyrics = () => {
  const { currentSong, currentTime, isPlaying } = usePlayerStore();

  const [state, setState] = useState<LyricsState>({
    lyrics: [],
    currentLineIndex: -1,
    currentLine: null,
    nextLine: null,
    loading: false,
    error: null,
  });

  // 获取歌词数据
  const fetchLyrics = useCallback(async (songId: string, songMid: string) => {
    if (!songId && !songMid) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await musicApi.getLyric({
        id: songId,
        mid: songMid,
      });

      if (response.code === 0 && response.data?.lyric) {
        const parsedLyrics = parseLRC(response.data.lyric);
        setState((prev) => ({
          ...prev,
          lyrics: parsedLyrics,
          loading: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          lyrics: [],
          loading: false,
          error: response.message || "获取歌词失败",
        }));
      }
    } catch (error) {
      console.error("获取歌词失败:", error);
      setState((prev) => ({
        ...prev,
        lyrics: [],
        loading: false,
        error: error instanceof Error ? error.message : "获取歌词失败",
      }));
    }
  }, []);

  // 根据当前播放时间计算当前歌词行
  const getCurrentLineIndex = useCallback(
    (currentTime: number, lyrics: LyricLine[]) => {
      if (lyrics.length === 0) return -1;

      // 歌词提前切换时间（毫秒）- 提前200ms切换，减少延迟感
      const ADVANCE_TIME = 0.2;

      // 找到最后一个时间小于等于当前时间（加上提前量）的歌词行
      let currentIndex = -1;
      const adjustedTime = currentTime + ADVANCE_TIME;

      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= adjustedTime) {
          currentIndex = i;
        } else {
          break;
        }
      }

      return currentIndex;
    },
    []
  );

  // 当歌曲变化时获取歌词
  useEffect(() => {
    if (currentSong?.id || currentSong?.mid) {
      fetchLyrics(currentSong.id || "", currentSong.mid || "");
    } else {
      setState((prev) => ({
        ...prev,
        lyrics: [],
        currentLineIndex: -1,
        currentLine: null,
        nextLine: null,
        error: null,
      }));
    }
  }, [currentSong?.id, currentSong?.mid, fetchLyrics]);

  // 当播放时间变化时更新当前歌词行
  useEffect(() => {
    if (state.lyrics.length > 0) {
      const newLineIndex = getCurrentLineIndex(currentTime, state.lyrics);

      if (newLineIndex !== state.currentLineIndex) {
        const currentLine =
          newLineIndex >= 0 ? state.lyrics[newLineIndex] : null;
        const nextLine =
          newLineIndex >= 0 && newLineIndex + 1 < state.lyrics.length
            ? state.lyrics[newLineIndex + 1]
            : null;

        setState((prev) => ({
          ...prev,
          currentLineIndex: newLineIndex,
          currentLine,
          nextLine,
        }));
      }
    }
  }, [currentTime, state.lyrics, state.currentLineIndex, getCurrentLineIndex]);

  // 计算当前行内的字符进度（用于卡拉OK效果）
  const getCharacterProgress = useMemo(() => {
    if (!state.currentLine) return 0;

    const lineStartTime = state.currentLine.time;
    let lineEndTime = lineStartTime + 4; // 默认4秒一行

    // 如果有下一行，使用下一行的时间
    if (state.nextLine) {
      lineEndTime = state.nextLine.time;
    }

    const lineDuration = lineEndTime - lineStartTime;
    if (lineDuration <= 0) return 0;

    const elapsedTime = currentTime - lineStartTime;
    const progress = Math.max(0, Math.min(1, elapsedTime / lineDuration));

    return progress;
  }, [state.currentLine, state.nextLine, currentTime]);

  // 重试获取歌词
  const retryFetchLyrics = useCallback(() => {
    if (currentSong?.id || currentSong?.mid) {
      fetchLyrics(currentSong.id || "", currentSong.mid || "");
    }
  }, [currentSong?.id, currentSong?.mid, fetchLyrics]);

  return {
    // 歌词数据
    lyrics: state.lyrics,
    currentLine: state.currentLine,
    nextLine: state.nextLine,
    currentLineIndex: state.currentLineIndex,

    // 状态
    loading: state.loading,
    error: state.error,
    hasLyrics: state.lyrics.length > 0,

    // 进度相关
    characterProgress: getCharacterProgress,

    // 方法
    retryFetchLyrics,
  };
};
