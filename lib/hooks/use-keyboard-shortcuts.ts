import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store/player";

interface KeyboardShortcuts {
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  enabled = true,
}: KeyboardShortcuts = {}) {
  const {
    isPlaying,
    volume,
    currentTime,
    duration,
    togglePlay,
    setVolume,
    setCurrentTime,
    playNext,
    playPrevious,
  } = usePlayerStore();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果用户正在输入框中输入，不触发快捷键
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      // 阻止浏览器默认行为
      const preventDefault = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      switch (event.code) {
        case "Space":
          // 空格键：播放/暂停
          preventDefault();
          togglePlay();
          break;

        case "ArrowLeft":
          if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd + 左箭头：上一首
            preventDefault();
            playPrevious();
          } else if (event.shiftKey) {
            // Shift + 左箭头：快退10秒
            preventDefault();
            const newTime = Math.max(0, currentTime - 10);
            setCurrentTime(newTime);
          }
          break;

        case "ArrowRight":
          if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd + 右箭头：下一首
            preventDefault();
            playNext();
          } else if (event.shiftKey) {
            // Shift + 右箭头：快进10秒
            preventDefault();
            const newTime = Math.min(duration, currentTime + 10);
            setCurrentTime(newTime);
          }
          break;

        case "ArrowUp":
          if (event.shiftKey) {
            // Shift + 上箭头：音量+10%
            preventDefault();
            const newVolume = Math.min(1, volume + 0.1);
            setVolume(newVolume);
          }
          break;

        case "ArrowDown":
          if (event.shiftKey) {
            // Shift + 下箭头：音量-10%
            preventDefault();
            const newVolume = Math.max(0, volume - 0.1);
            setVolume(newVolume);
          }
          break;

        case "KeyM":
          // M键：静音/取消静音
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            preventDefault();
            setVolume(volume > 0 ? 0 : 0.8);
          }
          break;

        case "Digit0":
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8":
        case "Digit9":
          // 数字键0-9：跳转到对应百分比位置
          if (event.shiftKey && duration > 0) {
            preventDefault();
            const digit = parseInt(event.code.replace("Digit", ""));
            const percentage = digit / 10; // 0-9 对应 0%-90%
            const newTime = duration * percentage;
            setCurrentTime(newTime);
          }
          break;

        default:
          break;
      }
    };

    // 监听媒体键事件
    const handleMediaKeys = (event: any) => {
      if (!("mediaSession" in navigator)) return;

      switch (event.action) {
        case "play":
          if (!isPlaying) togglePlay();
          break;
        case "pause":
          if (isPlaying) togglePlay();
          break;
        case "previoustrack":
          playPrevious();
          break;
        case "nexttrack":
          playNext();
          break;
        default:
          break;
      }
    };

    // 添加事件监听器
    document.addEventListener("keydown", handleKeyDown);

    // 如果支持MediaSession，设置媒体键处理
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("play", () => {
          if (!isPlaying) togglePlay();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          if (isPlaying) togglePlay();
        });
        navigator.mediaSession.setActionHandler("previoustrack", () => {
          playPrevious();
        });
        navigator.mediaSession.setActionHandler("nexttrack", () => {
          playNext();
        });
      } catch (error) {
        console.warn("MediaSession API not supported:", error);
      }
    }

    // 清理函数
    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      // 清理MediaSession handlers
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
        } catch (error) {
          // 忽略清理错误
        }
      }
    };
  }, [
    enabled,
    isPlaying,
    volume,
    currentTime,
    duration,
    togglePlay,
    setVolume,
    setCurrentTime,
    playNext,
    playPrevious,
  ]);

  // 返回快捷键帮助信息
  return {
    shortcuts: {
      Space: "播放/暂停",
      "Ctrl/Cmd + ←": "上一首",
      "Ctrl/Cmd + →": "下一首",
      "Shift + ←": "快退10秒",
      "Shift + →": "快进10秒",
      "Shift + ↑": "音量+10%",
      "Shift + ↓": "音量-10%",
      M: "静音/取消静音",
      "Shift + 0-9": "跳转到对应百分比位置",
    },
    mediaKeys: {
      "Play/Pause": "播放/暂停",
      "Previous Track": "上一首",
      "Next Track": "下一首",
    },
  };
}
