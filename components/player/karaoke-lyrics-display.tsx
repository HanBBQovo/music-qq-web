"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { usePlayerStore } from "@/lib/store/player";
import { type LyricLine } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface KaraokeLyricsDisplayProps {
  className?: string;
  mode?: "dual" | "compact";
}

export const KaraokeLyricsDisplay = React.memo(function KaraokeLyricsDisplay({
  className,
  mode = "dual",
}: KaraokeLyricsDisplayProps) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const lyricLines = usePlayerStore((s) => s.krcLyrics);
  const isLoading = usePlayerStore((s) => s.isKrcLyricsLoading);
  const error = usePlayerStore((s) => s.krcLyricsError);
  const fetchKrcLyrics = usePlayerStore((s) => s.fetchKrcLyrics);

  const [foregroundColor, setForegroundColor] = useState(
    "hsl(262.1 83.3% 57.8%)"
  );

  const lineFontSize = useMemo(() => (mode === "compact" ? 12 : 14), [mode]);
  const containerHeight = useMemo(
    () => (mode === "compact" ? "3.2em" : "4.8em"),
    [mode]
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wordSpanRefs = useRef<HTMLSpanElement[][]>([]);
  const rafId = useRef<number | null>(null);
  const currentLineIndexRef = useRef<number>(-1);

  const setLineRef = (el: HTMLDivElement | null, index: number) => {
    lineRefs.current[index] = el;
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateColor = () => {
      // Values from globals.css
      const lightModeColor = "hsl(262.1 83.3% 57.8%)";
      const darkModeColor = "hsl(263.4 70% 50.4%)";
      setForegroundColor(mediaQuery.matches ? darkModeColor : lightModeColor);
    };

    updateColor();
    mediaQuery.addEventListener("change", updateColor);
    return () => mediaQuery.removeEventListener("change", updateColor);
  }, []);

  // Effect to fetch lyrics if they are not available (e.g., on page refresh)
  useEffect(() => {
    if (currentSong?.id) {
      fetchKrcLyrics();
    }
  }, [currentSong?.id, fetchKrcLyrics]);

  // Effect to handle animation frame loop
  useEffect(() => {
    const stopRAF = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };

    const tick = () => {
      if (!lyricLines || !lyricLines.length || !tickerRef.current) {
        stopRAF();
        return;
      }

      const now = usePlayerStore.getState().currentTime * 1000;

      // --- Optimized Line Search using Binary Search ---
      let activeLineIndex = -1;

      // Binary search to find the current line
      if (lyricLines.length > 0) {
        let low = 0;
        let high = lyricLines.length - 1;
        let bestMatch = -1;

        while (low <= high) {
          const mid = low + Math.floor((high - low) / 2);
          if (lyricLines[mid].startTime <= now) {
            bestMatch = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        activeLineIndex = bestMatch;
      }
      // --- End of Optimized Line Search ---

      // Scroll and style update logic
      if (currentLineIndexRef.current !== activeLineIndex) {
        const viewportEl = viewportRef.current;
        const tickerEl = tickerRef.current;
        const activeLineEl = lineRefs.current[activeLineIndex];
        const prevLineEl = lineRefs.current[currentLineIndexRef.current];

        if (prevLineEl) {
          prevLineEl.style.opacity = "0.7";
          prevLineEl.style.fontWeight = "500";
        }

        if (activeLineEl) {
          activeLineEl.style.opacity = "1";
          activeLineEl.style.fontWeight = "600";

          if (viewportEl && tickerEl) {
            // New offset calculation for top alignment
            const offset = -activeLineEl.offsetTop;
            tickerEl.style.transform = `translateY(${offset}px)`;
          }
        }

        // Ensure the previous line is fully painted before switching
        const prevIndex = currentLineIndexRef.current;
        if (
          prevIndex !== -1 &&
          wordSpanRefs.current[prevIndex] &&
          lyricLines[prevIndex] // Ensure line data exists
        ) {
          wordSpanRefs.current[prevIndex].forEach((span) => {
            const fg = span?.querySelector(
              '[data-role="fg"]'
            ) as HTMLSpanElement;
            if (fg)
              fg.style.clipPath = `polygon(0 0, 100% 0, 100% 100%, 0 100%)`;
          });
        }

        // Reset future lines' progress
        if (activeLineIndex > -1) {
          for (let i = activeLineIndex + 1; i < lyricLines.length; i++) {
            const futureLineSpans = wordSpanRefs.current[i] || [];
            futureLineSpans.forEach((span) => {
              const fg = span?.querySelector(
                '[data-role="fg"]'
              ) as HTMLSpanElement;
              if (fg) fg.style.clipPath = `polygon(0 0, 0% 0, 0% 100%, 0 100%)`;
            });
          }
        }

        currentLineIndexRef.current = activeLineIndex;
      }

      // Animate words on the active line directly via DOM refs
      if (activeLineIndex !== -1) {
        const line = lyricLines[activeLineIndex];
        const wordSpans = wordSpanRefs.current[activeLineIndex] || [];

        line.words.forEach((word, j) => {
          const el = wordSpans[j];
          if (!el) return;

          const wordEndTime = word.startTime + word.duration;
          let prog;

          if (now >= wordEndTime) {
            prog = 1;
          } else if (now < word.startTime) {
            prog = 0;
          } else {
            prog =
              word.duration > 0 ? (now - word.startTime) / word.duration : 0;
          }
          prog = Math.max(0, Math.min(1, prog));

          const pct = prog * 100;
          const clipPathSpan = el.querySelector(
            '[data-role="fg"]'
          ) as HTMLSpanElement;
          if (clipPathSpan) {
            clipPathSpan.style.clipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
          }
        });
      }

      rafId.current = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      stopRAF();
      rafId.current = requestAnimationFrame(tick);
    } else {
      stopRAF();
    }

    return stopRAF;
  }, [isPlaying, lyricLines]);

  // When lyrics data changes (new song), reset internal state
  useEffect(() => {
    wordSpanRefs.current = lyricLines ? lyricLines.map(() => []) : [];
    lineRefs.current = lyricLines
      ? new Array(lyricLines.length).fill(null)
      : [];
    currentLineIndexRef.current = -1;
    if (tickerRef.current) {
      tickerRef.current.style.transform = "translateY(0px)";
    }

    if (lyricLines && lyricLines.length > 0) {
      // Set initial visible line without triggering animation yet
      const now = usePlayerStore.getState().currentTime * 1000;
      let initialIndex = -1;
      for (let i = lyricLines.length - 1; i >= 0; i--) {
        if (now > lyricLines[i].startTime) {
          initialIndex = i;
          break;
        }
      }
      if (initialIndex === -1 && lyricLines.length > 0) initialIndex = 0;

      // Force a small timeout to allow React to render the lines so we can calculate offset
      setTimeout(() => {
        const viewportEl = viewportRef.current;
        const tickerEl = tickerRef.current;
        const activeLineEl = lineRefs.current[initialIndex];

        if (activeLineEl) {
          activeLineEl.style.opacity = "1";
          activeLineEl.style.fontWeight = "600";
        }

        if (viewportEl && tickerEl && activeLineEl) {
          // New offset calculation for top alignment
          const offset = -activeLineEl.offsetTop;
          tickerEl.style.transform = `translateY(${offset}px)`;
        }
        currentLineIndexRef.current = initialIndex;
      }, 50);
    }
  }, [lyricLines]);

  if (isLoading) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        歌词加载中...
      </p>
    );
  }

  if (error) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{error}</p>
    );
  }

  if (!lyricLines || lyricLines.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        ♪ 暂无歌词 ♪
      </p>
    );
  }

  const getLineStyle = (isCurrent: boolean) => {
    // These styles are now the base, dynamic changes happen via refs
    return {
      fontSize: mode === "compact" ? 12 : 14,
      fontWeight: 500,
      lineHeight: 1.6,
      whiteSpace: "normal" as const, // Allow wrapping
      opacity: 0.7,
      transition: "opacity 0.3s ease-in-out",
    };
  };

  const renderLine = (line: LyricLine, lineIndex: number) => (
    <div
      key={line.startTime}
      ref={(el) => setLineRef(el, lineIndex)}
      style={getLineStyle(lineIndex === -1)} // Pass dummy value
    >
      {line.words.map((w, j) => (
        <span
          key={j}
          ref={(el) => {
            if (!wordSpanRefs.current[lineIndex]) {
              wordSpanRefs.current[lineIndex] = [];
            }
            if (el) wordSpanRefs.current[lineIndex][j] = el;
          }}
          style={{
            display: "inline-block",
            position: "relative",
            color: "#888",
          }}
        >
          {/* Background text */}
          {w.text}
          {/* Foreground paint-over text */}
          <span
            data-role="fg"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: "100%",
              color: foregroundColor,
              overflow: "hidden",
              clipPath: "polygon(0 0, 0% 0, 0% 100%, 0 100%)",
              whiteSpace: "nowrap",
            }}
          >
            {w.text}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      ref={viewportRef}
      className={cn("w-full h-full relative overflow-hidden", className)}
      style={{ height: containerHeight, fontSize: `${lineFontSize}px` }}
    >
      <div
        ref={tickerRef}
        className="absolute w-full left-0 top-0 transition-transform duration-500 ease-in-out"
      >
        {lyricLines.map((line, index) => renderLine(line, index))}
      </div>
    </div>
  );
});

KaraokeLyricsDisplay.displayName = "KaraokeLyricsDisplay";
