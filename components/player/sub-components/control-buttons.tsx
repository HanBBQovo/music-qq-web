"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Repeat,
  Shuffle,
  RotateCcw,
  List,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface ControlButtonsProps {
  playMode: "order" | "random" | "loop";
  showPlayer: boolean;
  onPlayModeChange: () => void;
  onTogglePlaylist: () => void;
  onTogglePlayer: () => void;
}

export const ControlButtons = React.memo(function ControlButtons({
  playMode,
  showPlayer,
  onPlayModeChange,
  onTogglePlaylist,
  onTogglePlayer,
}: ControlButtonsProps) {
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
      {/* 播放模式 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onPlayModeChange}
        className="h-8 w-8 p-0"
        title={getPlayModeTitle()}
      >
        {getPlayModeIcon()}
      </Button>

      {/* 播放列表 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onTogglePlaylist}
        className="h-8 w-8 p-0"
        title="播放列表"
      >
        <List className="h-4 w-4" />
      </Button>

      {/* 展开/收缩按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onTogglePlayer}
        className="h-8 w-8 p-0"
        title={showPlayer ? "收起播放器" : "展开播放器"}
      >
        {showPlayer ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </Button>
    </>
  );
});