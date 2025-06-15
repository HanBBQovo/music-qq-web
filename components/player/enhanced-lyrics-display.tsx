"use client";

import React, { useEffect, useRef } from "react";
import { useLyrics } from "@/lib/hooks/use-lyrics";
import { cn } from "@/lib/utils";
import { LoaderIcon, Music } from "lucide-react";

interface EnhancedLyricsDisplayProps {
  className?: string;
  showKaraokeEffect?: boolean;
  mode?: "dual" | "current" | "full";
}

export const EnhancedLyricsDisplay: React.FC<EnhancedLyricsDisplayProps> =
  React.memo(({ className, mode = "dual" }) => {
    const {
      lyrics,
      currentLine,
      nextLine,
      currentLineIndex,
      loading,
      error,
      hasLyrics,
    } = useLyrics();

    const fullLyricsRef = useRef<HTMLDivElement>(null);

    // 自动滚动到当前行（全歌词模式）
    useEffect(() => {
      if (mode === "full" && fullLyricsRef.current && currentLineIndex >= 0) {
        const currentElement = fullLyricsRef.current.children[
          currentLineIndex
        ] as HTMLElement;
        if (currentElement) {
          currentElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }, [currentLineIndex, mode]);

    if (loading) {
      return (
        <div className={cn("flex items-center justify-center py-2", className)}>
          <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            加载歌词中...
          </span>
        </div>
      );
    }

    if (!hasLyrics || !currentLine?.text) {
      return null;
    }

    // 双行模式
    if (mode === "dual") {
      return (
        <div className={cn("relative py-2 px-3 h-16", className)}>
          <div className="grid grid-rows-[auto_auto] gap-1 h-full overflow-hidden">
            {/* 当前歌词行 */}
            <div className="min-h-0">
              <div className="text-sm font-medium text-primary break-words leading-tight line-clamp-2">
                {currentLine.text}
              </div>
            </div>

            {/* 下一行歌词 */}
            <div className="min-h-0">
              <div className="text-xs text-muted-foreground/50 break-words leading-tight line-clamp-1">
                {nextLine?.text || ""}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 单行模式
    if (mode === "current") {
      return (
        <div className={cn("relative py-1 px-2 h-8", className)}>
          <div className="h-full overflow-hidden flex items-center">
            <div className="text-sm font-medium text-primary break-words leading-tight line-clamp-2 w-full">
              {currentLine.text}
            </div>
          </div>
        </div>
      );
    }

    // 全歌词模式
    return (
      <div className={cn("relative py-3 px-4", className)}>
        <div
          ref={fullLyricsRef}
          className="max-h-64 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        >
          {lyrics.map((line, index) => (
            <div
              key={index}
              className={cn(
                "text-sm transition-all duration-300 px-2 py-1 rounded-sm",
                index === currentLineIndex
                  ? "text-primary font-semibold bg-primary/10 shadow-sm"
                  : index < currentLineIndex
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground"
              )}
            >
              <div className="break-words leading-relaxed">
                {line.text || "♪"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  });

// 简化版歌词组件 - 移动端优化
export const CompactEnhancedLyricsDisplay: React.FC<EnhancedLyricsDisplayProps> =
  React.memo(({ className }) => {
    const { currentLine, hasLyrics } = useLyrics();

    // 如果没有歌词或当前行为空，不显示
    if (!hasLyrics || !currentLine?.text) {
      return null;
    }

    return (
      <div className={cn("relative py-1 px-2 h-6", className)}>
        <div className="h-full overflow-hidden flex items-center justify-center">
          <div className="text-xs text-muted-foreground break-words leading-tight line-clamp-1 w-full text-center">
            {currentLine.text}
          </div>
        </div>
      </div>
    );
  });
