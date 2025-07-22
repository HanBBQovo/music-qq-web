"use client";

import React from "react";
import { DynamicCover } from "../dynamic-cover";
import type { Song } from "@/lib/types/music";

interface SongInfoProps {
  song: Song;
  isPlaying: boolean;
  audioElement: HTMLAudioElement | null;
  size?: "small" | "large";
}

export const SongInfo = React.memo(function SongInfo({
  song,
  isPlaying,
  audioElement,
  size = "large",
}: SongInfoProps) {
  return (
    <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
      <div className="flex-shrink-0">
        <DynamicCover
          src={song.cover}
          alt={song.title}
          size={size}
          isPlaying={isPlaying}
          audioElement={audioElement}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>
    </div>
  );
});