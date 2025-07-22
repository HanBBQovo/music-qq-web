"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  localProgress: number;
  isDragging: boolean;
  draggingTime: number;
  onProgressStart: () => void;
  onProgressChange: (value: number[]) => void;
  onProgressCommit: (value: number[]) => void;
}

export const ProgressBar = React.memo(function ProgressBar({
  currentTime,
  duration,
  localProgress,
  isDragging,
  draggingTime,
  onProgressStart,
  onProgressChange,
  onProgressCommit,
}: ProgressBarProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 flex-1 max-w-md">
      <span className="text-xs text-muted-foreground w-10 text-right">
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
      <span className="text-xs text-muted-foreground w-10">
        {formatTime(duration)}
      </span>
    </div>
  );
});