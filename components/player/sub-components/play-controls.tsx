"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  LoaderIcon,
} from "lucide-react";

interface PlayControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  size?: "compact" | "normal";
}

export const PlayControls = React.memo(function PlayControls({
  isPlaying,
  isLoading,
  onPlayPause,
  onPrevious,
  onNext,
  size = "normal",
}: PlayControlsProps) {
  const playButtonSize = size === "compact" ? "h-8 w-8" : "h-10 w-10";
  const skipButtonSize = "h-8 w-8";
  const iconSize = size === "compact" ? "h-4 w-4" : "h-5 w-5";
  const skipIconSize = "h-4 w-4";

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={onPrevious}
        className={`${skipButtonSize} p-0`}
        title="上一首"
      >
        <SkipBack className={skipIconSize} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onPlayPause}
        disabled={isLoading}
        className={`${playButtonSize} p-0`}
        title={isLoading ? "正在加载..." : isPlaying ? "暂停" : "播放"}
      >
        {isLoading ? (
          <LoaderIcon className={`${iconSize} animate-spin`} />
        ) : isPlaying ? (
          <Pause className={iconSize} />
        ) : (
          <Play className={iconSize} />
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onNext}
        className={`${skipButtonSize} p-0`}
        title="下一首"
      >
        <SkipForward className={skipIconSize} />
      </Button>
    </div>
  );
});