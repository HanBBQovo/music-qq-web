"use client";

import { useState, useEffect } from "react";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useAudioPlayer } from "@/lib/hooks/use-audio-player";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  List,
  Repeat,
  Shuffle,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaylistPanel } from "./playlist-panel";

export function MiniPlayer() {
  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    playMode,
    showPlayer,
    showPlaylist,
    togglePlay,
    setVolume,
    setCurrentTime,
    playNext,
    playPrevious,
    setPlayMode,
    setShowPlayer,
    setShowPlaylist,
  } = usePlayerStore();

  // 使用音频播放器hook
  const { seekTo } = useAudioPlayer();

  const [localVolume, setLocalVolume] = useState(volume);
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  // 同步音量
  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  // 同步进度
  useEffect(() => {
    if (!isDragging && duration > 0) {
      setLocalProgress((currentTime / duration) * 100);
    }
  }, [currentTime, duration, isDragging]);

  // 如果没有当前歌曲，不显示播放器
  if (!currentSong) {
    return null;
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setLocalVolume(newVolume);
    setVolume(newVolume);
  };

  const handleProgressStart = () => {
    setIsDragging(true);
  };

  const handleProgressChange = (value: number[]) => {
    const progress = value[0];
    setLocalProgress(progress);
  };

  const handleProgressCommit = (value: number[]) => {
    const progress = value[0];
    const newTime = (progress / 100) * duration;
    // 使用音频播放器的seekTo方法来实际跳转时间
    seekTo(newTime);
    setIsDragging(false);
  };

  const toggleMute = () => {
    setVolume(volume > 0 ? 0 : 0.8);
  };

  const handlePlayModeClick = () => {
    const modes = ["order", "random", "loop"] as const;
    const currentIndex = modes.indexOf(playMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setPlayMode(modes[nextIndex]);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getPlayModeIcon = () => {
    switch (playMode) {
      case "random":
        return <Shuffle className="h-4 w-4" />;
      case "loop":
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <Repeat className="h-4 w-4" />;
    }
  };

  const getPlayModeTitle = () => {
    switch (playMode) {
      case "random":
        return "随机播放";
      case "loop":
        return "单曲循环";
      default:
        return "顺序播放";
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 transition-transform duration-300",
          showPlayer ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            {/* 歌曲信息 */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                {currentSong.cover ? (
                  <img
                    src={currentSong.cover}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Play className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {currentSong.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentSong.artist}
                </p>
              </div>
            </div>

            {/* 播放控制 */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={playPrevious}
                className="h-8 w-8 p-0"
                title="上一首"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                className="h-10 w-10 p-0"
                title={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={playNext}
                className="h-8 w-8 p-0"
                title="下一首"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* 进度条 */}
            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
              <span className="text-xs text-muted-foreground w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[localProgress]}
                onValueChange={handleProgressChange}
                onValueCommit={handleProgressCommit}
                onPointerDown={handleProgressStart}
                max={100}
                step={0.1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10">
                {formatTime(duration)}
              </span>
            </div>

            {/* 右侧控制 */}
            <div className="flex items-center gap-2">
              {/* 播放模式 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayModeClick}
                className="h-8 w-8 p-0 hidden sm:flex"
                title={getPlayModeTitle()}
              >
                {getPlayModeIcon()}
              </Button>

              {/* 音量控制 */}
              <div className="hidden lg:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="h-8 w-8 p-0"
                  title={volume > 0 ? "静音" : "取消静音"}
                >
                  {volume > 0 ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </Button>
                <Slider
                  value={[localVolume * 100]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-20"
                />
              </div>

              {/* 播放列表 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlaylist(!showPlaylist)}
                className="h-8 w-8 p-0"
                title="播放列表"
              >
                <List className="h-4 w-4" />
              </Button>

              {/* 展开/收缩按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlayer(!showPlayer)}
                className="h-8 w-8 p-0"
                title={showPlayer ? "收起播放器" : "展开播放器"}
              >
                {showPlayer ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 移动端进度条 */}
          <div className="md:hidden mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[localProgress]}
                onValueChange={handleProgressChange}
                onValueCommit={handleProgressCommit}
                onPointerDown={handleProgressStart}
                max={100}
                step={0.1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 播放列表面板 */}
      <PlaylistPanel />

      {/* 当播放器隐藏时显示的悬浮展开按钮 */}
      {!showPlayer && (
        <button
          onClick={() => setShowPlayer(true)}
          className="fixed bottom-6 right-6 z-50 rounded-full p-3 bg-primary text-primary-foreground cursor-pointer select-none transition-all duration-200"
          title="展开播放器"
          style={{
            pointerEvents: "auto",
            boxShadow:
              "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow =
              "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow =
              "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";
          }}
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
    </>
  );
}
