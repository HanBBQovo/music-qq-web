"use client";

import React from "react";
import { SongInfo } from "./song-info";
import { PlayControls } from "./play-controls";
import { ProgressBar } from "./progress-bar";
import { VolumeControl } from "./volume-control";
import { QualitySelector } from "./quality-selector";
import { ControlButtons } from "./control-buttons";
import { KaraokeLyricsDisplay } from "../karaoke-lyrics-display";
import type { Song } from "@/lib/types/music";
import type { AudioQuality } from "@/lib/api/types";

interface DesktopPlayerLayoutProps {
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

export const DesktopPlayerLayout = React.memo(function DesktopPlayerLayout({
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
}: DesktopPlayerLayoutProps) {
  return (
    <div className="hidden lg:flex items-center gap-4">
      {/* 歌曲信息 */}
      <div className="w-48">
        <SongInfo
          song={currentSong}
          isPlaying={isPlaying}
          audioElement={audioElement}
          size="large"
        />
      </div>

      {/* 歌词显示区域 */}
      <div className="flex-1 min-w-0 max-w-md mr-4">
        <KaraokeLyricsDisplay className="text-left" mode="dual" />
      </div>

      {/* 播放控制 */}
      <PlayControls
        isPlaying={isPlaying}
        isLoading={isLoading}
        onPlayPause={onPlayPause}
        onPrevious={onPrevious}
        onNext={onNext}
        size="normal"
      />

      {/* 进度条 */}
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        localProgress={localProgress}
        isDragging={isDragging}
        draggingTime={draggingTime}
        onProgressStart={onProgressStart}
        onProgressChange={onProgressChange}
        onProgressCommit={onProgressCommit}
      />

      {/* 右侧控制 */}
      <div className="flex items-center gap-2 flex-shrink-0">
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
          showSlider={true}
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
    </div>
  );
});