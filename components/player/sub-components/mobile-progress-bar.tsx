"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";

interface MobileProgressBarProps {
  currentTime: number;
  duration: number;
  localProgress: number;
  isDragging: boolean;
  draggingTime: number;
  onProgressStart: () => void;
  onProgressChange: (value: number[]) => void;
  onProgressCommit: (value: number[]) => void;
}

export const MobileProgressBar = React.memo(function MobileProgressBar({
  currentTime,
  duration,
  localProgress,
  isDragging,
  draggingTime,
  onProgressStart,
  onProgressChange,
  onProgressCommit,
}: MobileProgressBarProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="px-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-8 text-right">
          {formatTime(isDragging ? draggingTime : currentTime)}
        </span>
        <Slider
          value={[localProgress]}
          onValueChange={onProgressChange}
          onValueCommit={onProgressCommit}
          onPointerDown={onProgressStart}
          max={100}
          step={0.1}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
});