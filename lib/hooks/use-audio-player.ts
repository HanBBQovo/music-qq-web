import { useEffect, useRef, useCallback, useState } from "react";
import { usePlayerStore } from "../store/usePlayerStore";
import { PlayerStatus, PlayError, PLAYER_CONFIG } from "../types/music";

// 音频播放Hook
export const useAudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.IDLE);
  const [error, setError] = useState<PlayError | null>(null);
  const [buffered, setBuffered] = useState(0);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  // 重试相关状态
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const maxRetries = 3;
  const retryTimeouts = useRef<NodeJS.Timeout[]>([]);
  const animationFrameId = useRef<number | null>(null);

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
  const createAudioElement = useCallback(
    (src: string): HTMLAudioElement => {
      const audio = new Audio();
      audio.src = src;
      audio.preload = "metadata";
      audio.crossOrigin = "anonymous"; // 支持跨域

      // 为音频元素添加唯一标识
      const songId = currentSong?.mid || currentSong?.id;
      if (songId) {
        (audio as any)._songId = songId;
      }
      (audio as any)._createTime = Date.now();

      return audio;
    },
    [currentSong]
  );

  // 清理重试定时器
  const cleanupRetryTimeouts = useCallback(() => {
    retryTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    retryTimeouts.current = [];
  }, []);

  // 判断错误是否可以重试
  const isRetryableError = useCallback((errorCode: string): boolean => {
    return ["MEDIA_ERR_NETWORK", "MEDIA_ERR_DECODE", "PLAY_FAILED"].includes(
      errorCode
    );
  }, []);

  // 重试播放
  const performRetry = useCallback(
    async (attempt: number) => {
      if (!currentSong?.url || attempt > maxRetries) {
        console.error(`❌ 重试失败，已达到最大重试次数 (${maxRetries})`);
        setIsRetrying(false);
        return;
      }

      setIsRetrying(true);
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数退避，最大5秒

      console.log(`🔄 第 ${attempt} 次重试播放 (${delay}ms后)...`);

      const timeout = setTimeout(async () => {
        try {
          if (audioRef.current && currentSong.url) {
            // 重新设置音频源
            audioRef.current.src = currentSong.url;
            audioRef.current.load();

            // 如果之前在播放，尝试恢复播放
            if (isPlaying) {
              await audioRef.current.play();
              console.log(`✅ 第 ${attempt} 次重试成功`);
              setError(null);
              setRetryCount(0);
              // 播放成功后手动启动RAF循环
              const { play } = usePlayerStore.getState();
              play();
            }
          }
          setIsRetrying(false);
        } catch (error) {
          console.error(`❌ 第 ${attempt} 次重试失败:`, error);
          if (attempt < maxRetries) {
            performRetry(attempt + 1);
          } else {
            setIsRetrying(false);
          }
        }
      }, delay);

      retryTimeouts.current.push(timeout);
    },
    [currentSong, isPlaying, maxRetries]
  );

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
      // timeupdate 事件仍可用于低频任务，如更新缓冲条
      audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
      audioRef.current.removeEventListener("progress", handleProgress);
    }

    // 重置重试状态
    setRetryCount(0);
    setIsRetrying(false);
    cleanupRetryTimeouts();

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
    // timeupdate 事件仍可用于低频任务，如更新缓冲条
    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.current.addEventListener("progress", handleProgress);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      cleanupRetryTimeouts();
    };
  }, [currentSong?.url]); // 移除volume依赖，避免音量变化时重新创建音频元素

  // 高精度时间更新循环
  useEffect(() => {
    const frameUpdater = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animationFrameId.current = requestAnimationFrame(frameUpdater);
    };

    if (isPlaying) {
      // 停止任何可能正在运行的旧循环
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      animationFrameId.current = requestAnimationFrame(frameUpdater);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }

    // 清理函数
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, setCurrentTime]);

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
    // 清除之前可能存在的错误
    setError(null);

    // 检查是否需要跳转到指定时间（音质切换场景）
    if (audioRef.current && currentTime > 0) {
      const timeDiff = Math.abs(currentTime - audioRef.current.currentTime);
      if (timeDiff > 1) {
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(currentTime, audioRef.current.duration || 0)
        );
      }
    }

    // 如果应该播放，则开始播放
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.error("播放启动失败:", error);
        const playError: PlayError = {
          code: "PLAY_FAILED",
          message: "播放启动失败: " + error.message,
          song: currentSong || undefined,
        };
        setError(playError);
        setStatus(PlayerStatus.ERROR);

        // 确保播放状态设置为暂停
        const { pause } = usePlayerStore.getState();
        pause();
      });
    }
  }, [isPlaying, status, currentSong, currentTime]);

  const handlePlay = useCallback(() => {
    setStatus(PlayerStatus.PLAYING);
    // 确保调用Zustand的play方法来同步状态并启动RAF循环
    play();
  }, [play]);

  const handlePause = useCallback(() => {
    setStatus(PlayerStatus.PAUSED);
    // 确保调用Zustand的pause方法来同步状态并停止RAF循环
    pause();
  }, [pause]);

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

    // timeupdate 事件处理器现在只用于低频更新，比如缓冲进度
    // (如果需要的话，目前它什么都不做)
    if (audioRef.current) {
      // 我们可以用它来更新缓冲信息，而不是当前时间
    }
  }, [playMode, playNext, setCurrentTime]);

  const handleError = useCallback(
    (event: Event) => {
      const audio = event.target as HTMLAudioElement;
      const error = audio.error;

      // 改进的错误识别逻辑：检查音频元素的标识和创建时间
      const audioSongId = (audio as any)._songId;
      const audioCreateTime = (audio as any)._createTime;
      const currentIdentifier = currentSong?.mid || currentSong?.id;
      const currentAudioCreateTime = (audioRef.current as any)?._createTime;

      // 更准确的判断：检查songId匹配且是当前音频元素
      const isCurrentAudio =
        currentIdentifier &&
        audioSongId === currentIdentifier &&
        audioCreateTime === currentAudioCreateTime;

      if (!isCurrentAudio) {
        console.warn("🔄 忽略过期音频元素的错误:", {
          audioSongId,
          currentIdentifier,
          audioCreateTime,
          currentAudioCreateTime,
          isCurrentAudio,
        });
        return;
      }

      let errorMessage = "播放出错";
      let errorCode = "UNKNOWN_ERROR";
      let shouldRetry = false;

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
            shouldRetry = true;
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "解码错误";
            errorCode = "MEDIA_ERR_DECODE";
            shouldRetry = true;
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

      console.error("⚠️ 音频播放错误:", {
        error: playError,
        audioElement: {
          src: audio.src?.substring(0, 80) + "...",
          readyState: audio.readyState,
          networkState: audio.networkState,
        },
        currentSong: currentSong?.title,
        shouldRetry,
      });

      // 设置错误状态
      setError(playError);
      setStatus(PlayerStatus.ERROR);

      // 确保播放状态设置为暂停
      const { pause } = usePlayerStore.getState();
      pause();

      // 如果可以重试且还没超过重试次数
      if (shouldRetry && retryCount < maxRetries && !isRetrying) {
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        performRetry(nextRetryCount);
      }
    },
    [currentSong, status, retryCount, isRetrying, performRetry, maxRetries]
  );

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      // 使用节流的时间更新，减少状态更新频率
      // throttledSetCurrentTime(audioRef.current.currentTime);
    }
  }, []);

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

      // 确保播放状态设置为暂停
      const { pause } = usePlayerStore.getState();
      pause();

      // 如果可以重试且还没超过重试次数
      if (retryCount < maxRetries && !isRetrying) {
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        performRetry(nextRetryCount);
      }
    },
    [currentSong, retryCount, maxRetries, isRetrying, performRetry]
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
        let retryCount = 0;
        const maxRetries = 50; // 减少最大重试次数到2.5秒 (50ms * 50)

        const waitForReady = () => {
          if (!audioRef.current) {
            return;
          }

          if (audioRef.current.readyState >= 2) {
            // HAVE_CURRENT_DATA或更高
            // 音频已经可以播放，设置时间位置
            try {
              audioRef.current.currentTime = Math.max(
                0,
                Math.min(targetTime, audioRef.current.duration || 0)
              );

              // 更新store中的currentTime
              setCurrentTime(audioRef.current.currentTime);

              // 如果应该恢复播放，则开始播放
              if (shouldResumePlayback) {
                // 延迟一下确保音频完全就绪，然后直接播放
                setTimeout(() => {
                  if (audioRef.current && audioRef.current.paused) {
                    audioRef.current
                      .play()
                      .then(() => {
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
              setTimeout(waitForReady, 100); // 增加等待间隔到100ms，减少CPU占用
            } else {
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
    isLoading: status === PlayerStatus.LOADING || isRetrying,
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
      setRetryCount(0);
      setIsRetrying(false);
      cleanupRetryTimeouts();

      if (currentSong?.url) {
        if (audioRef.current) {
          audioRef.current.src = currentSong.url;
          audioRef.current.load();
        }
      }
    },

    // 重试状态
    retryCount,
    isRetrying,
    maxRetries,
  };
};
