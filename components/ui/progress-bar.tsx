"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** 0-100 的百分比 */
  value?: number;
  /** 额外类名 */
  className?: string;
  /** 颜色主题 */
  color?: "primary" | "muted" | "success" | "danger";
}

/**
 * 通用进度条组件，带平滑动画。
 */
export const ProgressBar: React.FC<ProgressBarProps> = React.memo(
  ({ value = 0, className, color = "primary" }) => {
    const percentage = Math.max(0, Math.min(100, Math.round(value)));

    const colorClass = (() => {
      switch (color) {
        case "success":
          return "from-green-500 to-green-400";
        case "danger":
          return "from-red-500 to-red-400";
        case "muted":
          return "bg-muted-foreground/50";
        default:
          return "from-primary to-primary/80";
      }
    })();

    return (
      <div
        className={cn(
          "h-2 bg-muted w-full rounded-full overflow-hidden",
          className
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            color === "muted" ? colorClass : `bg-gradient-to-r ${colorClass}`
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
);
