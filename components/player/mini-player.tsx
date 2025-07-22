"use client";

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { usePlayerStore } from "@/lib/store/player";
import { useAudioPlayer } from "@/lib/hooks/use-audio-player";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudioQuality } from "@/lib/api/types";
import { toast } from "sonner";
import React from "react";
import { resetGlobalAudioAnalyser } from "@/lib/audio/audio-analyzer";

// 懒加载大型组件
const PlaylistPanel = lazy(() => import("./playlist-panel").then(module => ({ default: module.PlaylistPanel })));
const DesktopPlayerLayout = lazy(() => import("./sub-components/desktop-player-layout").then(module => ({ default: module.DesktopPlayerLayout })));
const TabletPlayerLayout = lazy(() => import("./sub-components/tablet-player-layout").then(module => ({ default: module.TabletPlayerLayout })));
const MobilePlayerLayout = lazy(() => import("./sub-components/mobile-player-layout").then(module => ({ default: module.MobilePlayerLayout })));

// 加载状态组件
const LoadingFallback = () => <div className="animate-pulse bg-muted h-16 w-full rounded" />;

export function MiniPlayer() {
  // 单字段选择，避免快照重建 - 保持原来的模式但使用 useCallback 优化
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playMode = usePlayerStore((s) => s.playMode);
  const currentQuality = usePlayerStore((s) => s.currentQuality);
  const showPlayer = usePlayerStore((s) => s.showPlayer);
  const showPlaylist = usePlayerStore((s) => s.showPlaylist);
  const availableQualities = usePlayerStore((s) => s.availableQualities);
  const qualitySizes = usePlayerStore((s) => s.qualitySizes);
  const recommendedQuality = usePlayerStore((s) => s.recommendedQuality);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrevious = usePlayerStore((s) => s.playPrevious);
  const setPlayMode = usePlayerStore((s) => s.setPlayMode);
  const setShowPlayer = usePlayerStore((s) => s.setShowPlayer);
  const setShowPlaylist = usePlayerStore((s) => s.setShowPlaylist);
  const switchQuality = usePlayerStore((s) => s.switchQuality);
  const playSong = usePlayerStore((s) => s.playSong);

  // 简化渲染追踪，只在开发时使用
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  // 使用音频播放器hook
  const { seekTo, audioElement, isLoading } = useAudioPlayer();

  const [localVolume, setLocalVolume] = useState(volume);
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [draggingTime, setDraggingTime] = useState(0);

  // 恢复简单的进度条逻辑
  useEffect(() => {
    if (!isDragging && duration > 0) {
      setLocalProgress((currentTime / duration) * 100);
    }
  }, [currentTime, duration, isDragging]);

  // 同步音量
  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  // 监听歌曲变化
  useEffect(() => {
    // 当歌曲变化时，重置音频分析器
    if (currentSong?.id) {
      // console.log(`🎵 检测到歌曲变化: ${currentSong.title}`);
      resetGlobalAudioAnalyser();
    }
  }, [currentSong?.id]);

  // 处理音质切换 - 使用 useCallback 优化
  const handleQualityChange = useCallback(async (quality: AudioQuality) => {
    if (quality === currentQuality) return;

    const loadingToast = toast.loading(`正在切换音质...`);

    try {
      await switchQuality(quality);
      toast.dismiss(loadingToast);
      toast.success(`已切换音质`);
    } catch (error) {
      console.error("切换音质失败:", error);
      toast.dismiss(loadingToast);
      toast.error(`切换音质失败，请重试`);
    }
  }, [currentQuality, switchQuality]);

  const handlePlayPause = useCallback(() => {
    // 如果歌曲URL无效，并且当前未在播放，则强制调用playSong重新获取
    if (currentSong && !currentSong.url && !isPlaying) {
      playSong(currentSong);
    } else {
      // 否则，只切换播放/暂停状态
      togglePlay();
    }
    // 在用户交互时尝试启动音频上下文
    if (typeof window !== "undefined") {
      const event = new CustomEvent("user-interaction-play");
      window.dispatchEvent(event);
    }
  }, [currentSong, isPlaying, playSong, togglePlay]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0] / 100;
    setLocalVolume(newVolume);
    setVolume(newVolume);
  }, [setVolume]);

  const toggleMute = useCallback(() => {
    setVolume(volume > 0 ? 0 : 0.8);
  }, [volume, setVolume]);

  const handleProgressStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleProgressChange = useCallback((value: number[]) => {
    const progress = value[0];
    setLocalProgress(progress);
    // 计算拖动时对应的时间
    const newTime = (progress / 100) * duration;
    setDraggingTime(newTime);
  }, [duration]);

  const handleProgressCommit = useCallback((value: number[]) => {
    const progress = value[0];
    const newTime = (progress / 100) * duration;
    seekTo(newTime);
    setIsDragging(false);
    setDraggingTime(0);
  }, [duration, seekTo]);

  const handlePlayModeClick = useCallback(() => {
    const modes = ["order", "random", "loop"] as const;
    const currentIndex = modes.indexOf(playMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setPlayMode(modes[nextIndex]);
  }, [playMode, setPlayMode]);

  // 优化的播放列表和播放器切换回调
  const handleTogglePlaylist = useCallback(() => {
    setShowPlaylist(!showPlaylist);
  }, [showPlaylist, setShowPlaylist]);

  const handleTogglePlayer = useCallback(() => {
    setShowPlayer(!showPlayer);
  }, [showPlayer, setShowPlayer]);

  // 如果没有当前歌曲，显示空状态
  if (!currentSong) {
    return (
      <>
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 transition-transform duration-300",
            showPlayer ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">暂无播放歌曲</p>
                <p className="text-xs text-muted-foreground">
                  从搜索或专辑中选择歌曲开始播放
                </p>
              </div>

              {/* 播放列表按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlaylist(!showPlaylist)}
                className="h-8 w-8 p-0"
                title="播放列表"
              >
                <List className="h-4 w-4" />
              </Button>

              {/* 收起按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlayer(false)}
                className="h-8 w-8 p-0"
                title="收起播放器"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 播放列表面板 */}
        <PlaylistPanel />

        {/* 当播放器隐藏时显示的悬浮展开按钮 */}
        {!showPlayer && (
          <button
            onClick={() => setShowPlayer(true)}
            className="btn-float lg:bottom-12 md:bottom-30 bottom-24"
            title="展开播放器"
          >
            <ChevronUp className="h-6 w-6" />
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 transition-transform duration-300",
          showPlayer ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="container mx-auto px-4 py-4">
          {/* 桌面端布局 */}
          <Suspense fallback={<LoadingFallback />}>
            <DesktopPlayerLayout
              currentSong={currentSong}
              isPlaying={isPlaying}
              isLoading={isLoading}
              volume={volume}
              localVolume={localVolume}
              currentTime={currentTime}
              duration={duration}
              localProgress={localProgress}
              isDragging={isDragging}
              draggingTime={draggingTime}
              playMode={playMode}
              currentQuality={currentQuality}
              showPlayer={showPlayer}
              availableQualities={availableQualities}
              qualitySizes={qualitySizes}
              recommendedQuality={recommendedQuality}
              audioElement={audioElement}
              onPlayPause={handlePlayPause}
              onPrevious={playPrevious}
              onNext={playNext}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              onProgressStart={handleProgressStart}
              onProgressChange={handleProgressChange}
              onProgressCommit={handleProgressCommit}
              onPlayModeChange={handlePlayModeClick}
              onQualityChange={handleQualityChange}
              onTogglePlaylist={handleTogglePlaylist}
              onTogglePlayer={handleTogglePlayer}
            />
          </Suspense>

          {/* 平板端布局 */}
          <Suspense fallback={<LoadingFallback />}>
            <TabletPlayerLayout
              currentSong={currentSong}
              isPlaying={isPlaying}
              isLoading={isLoading}
              volume={volume}
              localVolume={localVolume}
              currentTime={currentTime}
              duration={duration}
              localProgress={localProgress}
              isDragging={isDragging}
              draggingTime={draggingTime}
              playMode={playMode}
              currentQuality={currentQuality}
              showPlayer={showPlayer}
              availableQualities={availableQualities}
              qualitySizes={qualitySizes}
              recommendedQuality={recommendedQuality}
              audioElement={audioElement}
              onPlayPause={handlePlayPause}
              onPrevious={playPrevious}
              onNext={playNext}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              onProgressStart={handleProgressStart}
              onProgressChange={handleProgressChange}
              onProgressCommit={handleProgressCommit}
              onPlayModeChange={handlePlayModeClick}
              onQualityChange={handleQualityChange}
              onTogglePlaylist={handleTogglePlaylist}
              onTogglePlayer={handleTogglePlayer}
            />
          </Suspense>

          {/* 手机端布局 */}
          <Suspense fallback={<LoadingFallback />}>
            <MobilePlayerLayout
              currentSong={currentSong}
              isPlaying={isPlaying}
              isLoading={isLoading}
              volume={volume}
              localVolume={localVolume}
              currentTime={currentTime}
              duration={duration}
              localProgress={localProgress}
              isDragging={isDragging}
              draggingTime={draggingTime}
              playMode={playMode}
              currentQuality={currentQuality}
              showPlayer={showPlayer}
              availableQualities={availableQualities}
              qualitySizes={qualitySizes}
              recommendedQuality={recommendedQuality}
              audioElement={audioElement}
              onPlayPause={handlePlayPause}
              onPrevious={playPrevious}
              onNext={playNext}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              onProgressStart={handleProgressStart}
              onProgressChange={handleProgressChange}
              onProgressCommit={handleProgressCommit}
              onPlayModeChange={handlePlayModeClick}
              onQualityChange={handleQualityChange}
              onTogglePlaylist={handleTogglePlaylist}
              onTogglePlayer={handleTogglePlayer}
            />
          </Suspense>
        </div>
      </div>

      {/* 播放列表面板 */}
      <Suspense fallback={null}>
        <PlaylistPanel />
      </Suspense>

      {/* 当播放器隐藏时显示的悬浮展开按钮 */}
      {!showPlayer && (
        <button
          onClick={() => setShowPlayer(true)}
          className="btn-float lg:bottom-12 md:bottom-34 bottom-31"
          title="展开播放器"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
    </>
  );
}
