import { useEffect, useRef, useCallback, useState } from "react";
import { usePlayerStore } from "../store/usePlayerStore";
import { Song, PlayerStatus, PlayError, PLAYER_CONFIG } from "../types/music";

// 音频播放Hook
export const useAudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.IDLE);
  const [error, setError] = useState<PlayError | null>(null);
  const [buffered, setBuffered] = useState(0);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  // 从状态管理中获取播放器状态和方法
  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    playMode,
    playlist,
    currentIndex,
    play,
    pause,
    setCurrentTime,
    setDuration,
    playNext,
    _getNextIndex,
  } = usePlayerStore();

  // 创建音频元素
  const createAudioElement = useCallback((src: string): HTMLAudioElement => {
    const audio = new Audio();
    audio.src = src;
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous"; // 支持跨域
    return audio;
  }, []);

  // 初始化音频元素
  useEffect(() => {
    if (!currentSong?.url) {
      return;
    }

    // 清理旧的音频元素
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener("loadstart", handleLoadStart);
      audioRef.current.removeEventListener(
        "loadedmetadata",
        handleLoadedMetadata
      );
      audioRef.current.removeEventListener("canplay", handleCanPlay);
      audioRef.current.removeEventListener("play", handlePlay);
      audioRef.current.removeEventListener("pause", handlePause);
      audioRef.current.removeEventListener("ended", handleEnded);
      audioRef.current.removeEventListener("error", handleError);
      audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
      audioRef.current.removeEventListener("progress", handleProgress);
    }

    // 创建新的音频元素
    audioRef.current = createAudioElement(currentSong.url);

    // 设置初始音量
    audioRef.current.volume = volume;

    // 添加事件监听器
    audioRef.current.addEventListener("loadstart", handleLoadStart);
    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current.addEventListener("canplay", handleCanPlay);
    audioRef.current.addEventListener("play", handlePlay);
    audioRef.current.addEventListener("pause", handlePause);
    audioRef.current.addEventListener("ended", handleEnded);
    audioRef.current.addEventListener("error", handleError);
    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.current.addEventListener("progress", handleProgress);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [currentSong?.url]); // 移除volume依赖，避免音量变化时重新创建音频元素

  // 事件处理器
  const handleLoadStart = useCallback(() => {
    setStatus(PlayerStatus.LOADING);
    setError(null);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, [setDuration]);

  const handleCanPlay = useCallback(() => {
    setStatus(PlayerStatus.IDLE);
    // 如果应该播放，则开始播放
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(handlePlayError);
    }
  }, [isPlaying]);

  const handlePlay = useCallback(() => {
    setStatus(PlayerStatus.PLAYING);
  }, []);

  const handlePause = useCallback(() => {
    setStatus(PlayerStatus.PAUSED);
  }, []);

  const handleEnded = useCallback(() => {
    setStatus(PlayerStatus.ENDED);
    setCurrentTime(0);

    // 根据播放模式决定下一步动作
    if (playMode === "loop") {
      // 单曲循环，重新播放当前歌曲
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(handlePlayError);
      }
    } else if (PLAYER_CONFIG.AUTO_PLAY_NEXT) {
      // 自动播放下一首
      playNext();
    }
  }, [playMode, playNext, setCurrentTime]);

  const handleError = useCallback(
    (event: Event) => {
      const audio = event.target as HTMLAudioElement;
      const error = audio.error;

      let errorMessage = "播放出错";
      let errorCode = "UNKNOWN_ERROR";

      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "播放被中止";
            errorCode = "MEDIA_ERR_ABORTED";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "网络错误";
            errorCode = "MEDIA_ERR_NETWORK";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "解码错误";
            errorCode = "MEDIA_ERR_DECODE";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "不支持的音频格式";
            errorCode = "MEDIA_ERR_SRC_NOT_SUPPORTED";
            break;
        }
      }

      const playError: PlayError = {
        code: errorCode,
        message: errorMessage,
        song: currentSong || undefined,
      };

      setError(playError);
      setStatus(PlayerStatus.ERROR);

      console.error("音频播放错误:", playError);
    },
    [currentSong]
  );

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, [setCurrentTime]);

  const handleProgress = useCallback(() => {
    if (audioRef.current && audioRef.current.buffered.length > 0) {
      const bufferedEnd = audioRef.current.buffered.end(
        audioRef.current.buffered.length - 1
      );
      const duration = audioRef.current.duration;
      if (duration > 0) {
        setBuffered((bufferedEnd / duration) * 100);
      }
    }
  }, []);

  const handlePlayError = useCallback(
    (error: Error) => {
      console.error("播放启动失败:", error);
      const playError: PlayError = {
        code: "PLAY_FAILED",
        message: "播放启动失败: " + error.message,
        song: currentSong || undefined,
      };
      setError(playError);
      setStatus(PlayerStatus.ERROR);
    },
    [currentSong]
  );

  // 播放控制方法
  const playAudio = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      await audioRef.current.play();
      play();
    } catch (error) {
      handlePlayError(error as Error);
    }
  }, [play, handlePlayError]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      pause();
    }
  }, [pause]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }, [isPlaying, playAudio, pauseAudio]);

  // 跳转到指定时间
  const seekTo = useCallback(
    (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(time, audioRef.current.duration || 0)
        );
        setCurrentTime(audioRef.current.currentTime);
      }
    },
    [setCurrentTime]
  );

  // 设置音量
  const setVolumeLevel = useCallback((level: number) => {
    const clampedVolume = Math.max(0, Math.min(1, level));
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // 预加载下一首歌曲
  const preloadNextSong = useCallback(() => {
    if (!PLAYER_CONFIG.PRELOAD_NEXT_SONG) return;

    const nextIndex = _getNextIndex();
    if (nextIndex >= 0 && nextIndex < playlist.length) {
      const nextSong = playlist[nextIndex];
      if (nextSong?.url) {
        // 清理之前的预加载
        if (preloadAudioRef.current) {
          preloadAudioRef.current.src = "";
        }

        // 创建新的预加载音频
        preloadAudioRef.current = createAudioElement(nextSong.url);
        preloadAudioRef.current.preload = "auto";
      }
    }
  }, [_getNextIndex, playlist, createAudioElement]);

  // 监听播放状态变化
  useEffect(() => {
    if (isPlaying && audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(handlePlayError);
    } else if (!isPlaying && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isPlaying, handlePlayError]);

  // 监听音量变化
  useEffect(() => {
    setVolumeLevel(volume);
  }, [volume, setVolumeLevel]);

  // 预加载下一首歌曲
  useEffect(() => {
    if (status === PlayerStatus.PLAYING) {
      preloadNextSong();
    }
  }, [status, preloadNextSong]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = "";
      }
    };
  }, []);

  // 返回音频播放器接口
  return {
    // 状态
    status,
    error,
    buffered,
    isLoading: status === PlayerStatus.LOADING,
    isPlaying: status === PlayerStatus.PLAYING,
    isPaused: status === PlayerStatus.PAUSED,
    hasError: status === PlayerStatus.ERROR,

    // 控制方法
    play: playAudio,
    pause: pauseAudio,
    toggle: togglePlayPause,
    seekTo,
    setVolume: setVolumeLevel,

    // 音频元素引用（用于高级操作）
    audioElement: audioRef.current,

    // 错误重试
    retry: () => {
      setError(null);
      setStatus(PlayerStatus.IDLE);
      if (currentSong?.url) {
        if (audioRef.current) {
          audioRef.current.src = currentSong.url;
          audioRef.current.load();
        }
      }
    },
  };
};
