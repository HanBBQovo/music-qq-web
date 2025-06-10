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
    console.log("🎵 音频可以播放，状态从", status, "->", PlayerStatus.IDLE);
    setStatus(PlayerStatus.IDLE);
    // 清除之前可能存在的错误
    setError(null);

    // 检查是否需要跳转到指定时间（音质切换场景）
    if (audioRef.current && currentTime > 0) {
      const timeDiff = Math.abs(currentTime - audioRef.current.currentTime);
      if (timeDiff > 1) {
        console.log(`🎯 音频准备完成，先跳转到: ${currentTime.toFixed(2)}s`);
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(currentTime, audioRef.current.duration || 0)
        );
      }
    }

    // 如果应该播放，则开始播放
    if (isPlaying && audioRef.current) {
      console.log("🎵 恢复播放状态");
      audioRef.current.play().catch((error) => {
        console.error("播放启动失败:", error);
        const playError: PlayError = {
          code: "PLAY_FAILED",
          message: "播放启动失败: " + error.message,
          song: currentSong || undefined,
        };
        setError(playError);
        setStatus(PlayerStatus.ERROR);
      });
    }
  }, [isPlaying, status, currentSong, currentTime]);

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
            // 播放被中止通常是正常的操作（如切换音质），不设置错误状态
            console.warn("🔄 音频播放被中止（可能是正常的切换操作）");
            return;
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
            // 检查是否是音质切换过程中的临时错误
            if (status === PlayerStatus.LOADING) {
              console.warn(
                "🔄 音质切换过程中的临时格式错误，将在加载完成后自动恢复"
              );
              return;
            }
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

      console.error("⚠️ 音频播放错误:", playError);
    },
    [currentSong, status]
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

  // 监听currentTime变化（用于手动拖拽进度条等场景）
  const lastSeekTimeRef = useRef<number>(0);
  useEffect(() => {
    // 只处理音频已经在播放中的时间跳转（如拖拽进度条）
    if (
      audioRef.current &&
      audioRef.current.readyState >= 2 &&
      status === PlayerStatus.PLAYING
    ) {
      const timeDiff = Math.abs(currentTime - audioRef.current.currentTime);

      // 只有当时间差异较大时才进行跳转（大于1秒），且不是音质切换场景
      if (timeDiff > 1 && currentTime !== lastSeekTimeRef.current) {
        console.log(
          `🎯 播放中的时间跳转: ${audioRef.current.currentTime.toFixed(
            2
          )}s -> ${currentTime.toFixed(2)}s`
        );
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(currentTime, audioRef.current.duration || 0)
        );
        lastSeekTimeRef.current = currentTime;
        console.log(`✅ 跳转完成: ${audioRef.current.currentTime.toFixed(2)}s`);
      }
    }
  }, [currentTime, status]);

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

  // 监听音质切换事件
  useEffect(() => {
    const handleQualitySwitch = (event: any) => {
      const { songId, targetTime, shouldResumePlayback } = event.detail;

      // 检查是否是当前播放的歌曲
      const currentIdentifier = currentSong?.mid || currentSong?.id;
      const isMatch = currentIdentifier === songId;

      console.log("🔄 收到音质切换事件:", {
        eventSongId: songId,
        currentIdentifier: currentIdentifier,
        isMatch: isMatch,
        targetTime: targetTime,
        shouldResumePlayback: shouldResumePlayback,
      });

      if (isMatch && audioRef.current) {
        console.log("🎯 音质切换: 等待音频就绪后处理时间跳转和播放恢复");

        let retryCount = 0;
        const maxRetries = 100; // 最多等待5秒 (50ms * 100)

        const waitForReady = () => {
          if (!audioRef.current) {
            console.warn("⚠️ 音质切换: 音频元素已被销毁");
            return;
          }

          if (audioRef.current.readyState >= 2) {
            // HAVE_CURRENT_DATA或更高
            // 音频已经可以播放，设置时间位置
            console.log(`🎯 音质切换: 设置时间到 ${targetTime.toFixed(2)}s`);
            try {
              audioRef.current.currentTime = Math.max(
                0,
                Math.min(targetTime, audioRef.current.duration || 0)
              );

              // 更新store中的currentTime
              setCurrentTime(audioRef.current.currentTime);

              // 如果应该恢复播放，则开始播放
              if (shouldResumePlayback) {
                console.log("🎵 音质切换: 恢复播放状态");

                // 延迟一下确保音频完全就绪，然后直接播放
                setTimeout(() => {
                  if (audioRef.current && audioRef.current.paused) {
                    audioRef.current
                      .play()
                      .then(() => {
                        console.log("🎵 音质切换: 播放恢复成功");
                        // 播放成功后更新store状态
                        const { play } = usePlayerStore.getState();
                        play();
                      })
                      .catch((error) => {
                        console.error("🎵 音质切换: 恢复播放失败:", error);
                      });
                  }
                }, 200);
              }
            } catch (error) {
              console.error("🎯 音质切换: 设置时间失败:", error);
            }
          } else {
            // 音频还没准备好，继续等待
            retryCount++;
            if (retryCount < maxRetries) {
              setTimeout(waitForReady, 50);
            } else {
              console.warn("⚠️ 音质切换: 等待音频就绪超时");
              // 即使超时，也尝试恢复播放状态
              if (shouldResumePlayback) {
                const { play } = usePlayerStore.getState();
                play();
              }
            }
          }
        };

        waitForReady();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("quality-switch", handleQualitySwitch);

      return () => {
        window.removeEventListener("quality-switch", handleQualitySwitch);
      };
    }
  }, [currentSong, setCurrentTime]);

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
