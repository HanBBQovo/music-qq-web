"use client";

import React from "react";
import { SongInfo } from "./song-info";
import { PlayControls } from "./play-controls";
import { VolumeControl } from "./volume-control";
import { QualitySelector } from "./quality-selector";
import { ControlButtons } from "./control-buttons";
import { MobileProgressBar } from "./mobile-progress-bar";
import { KaraokeLyricsDisplay } from "../karaoke-lyrics-display";
import type { Song } from "@/lib/types/music";
import type { AudioQuality } from "@/lib/api/types";

interface TabletPlayerLayoutProps {
  currentSong: Song;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  localVolume: number;
  currentTime: number;
  duration: number;
  localProgress: number;
  isDragging: boolean;
  draggingTime: number;
  playMode: "order" | "random" | "loop";
  currentQuality: AudioQuality;
  showPlayer: boolean;
  availableQualities: AudioQuality[];
  qualitySizes: Record<string, number>;
  recommendedQuality: AudioQuality | null;
  audioElement: HTMLAudioElement | null;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolumeChange: (value: number[]) => void;
  onToggleMute: () => void;
  onProgressStart: () => void;
  onProgressChange: (value: number[]) => void;
  onProgressCommit: (value: number[]) => void;
  onPlayModeChange: () => void;
  onQualityChange: (quality: AudioQuality) => void;
  onTogglePlaylist: () => void;
  onTogglePlayer: () => void;
}

export const TabletPlayerLayout = React.memo(function TabletPlayerLayout({
  currentSong,
  isPlaying,
  isLoading,
  volume,
  localVolume,
  currentTime,
  duration,
  localProgress,
  isDragging,
  draggingTime,
  playMode,
  currentQuality,
  showPlayer,
  availableQualities,
  qualitySizes,
  recommendedQuality,
  audioElement,
  onPlayPause,
  onPrevious,
  onNext,
  onVolumeChange,
  onToggleMute,
  onProgressStart,
  onProgressChange,
  onProgressCommit,
  onPlayModeChange,
  onQualityChange,
  onTogglePlaylist,
  onTogglePlayer,
}: TabletPlayerLayoutProps) {
  return (
    <div className="hidden md:block lg:hidden space-y-2">
      {/* 第一排：歌曲信息 + 核心播放控制 */}
      <div className="flex items-center gap-3">
        {/* 歌曲信息 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <SongInfo
            song={currentSong}
            isPlaying={isPlaying}
            audioElement={audioElement}
            size="large"
          />
        </div>

        {/* 核心播放控制 */}
        <PlayControls
          isPlaying={isPlaying}
          isLoading={isLoading}
          onPlayPause={onPlayPause}
          onPrevious={onPrevious}
          onNext={onNext}
          size="compact"
        />
      </div>

      {/* 第二排：歌词显示 */}
      <div className="px-1">
        <KaraokeLyricsDisplay className="text-center" mode="compact" />
      </div>

      {/* 第三排：辅助功能按钮 */}
      <div className="flex items-center justify-center gap-2">
        <ControlButtons
          playMode={playMode}
          showPlayer={showPlayer}
          onPlayModeChange={onPlayModeChange}
          onTogglePlaylist={onTogglePlaylist}
          onTogglePlayer={onTogglePlayer}
        />

        {/* 音量控制 */}
        <VolumeControl
          volume={volume}
          localVolume={localVolume}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
          showSlider={false}
        />

        {/* 音质选择器 */}
        <QualitySelector
          currentQuality={currentQuality}
          availableQualities={availableQualities}
          qualitySizes={qualitySizes}
          recommendedQuality={recommendedQuality}
          onQualityChange={onQualityChange}
        />
      </div>

      {/* 第四排：进度条 */}
      <MobileProgressBar
        currentTime={currentTime}
        duration={duration}
        localProgress={localProgress}
        isDragging={isDragging}
        draggingTime={draggingTime}
        onProgressStart={onProgressStart}
        onProgressChange={onProgressChange}
        onProgressCommit={onProgressCommit}
      />
    </div>
  );
});