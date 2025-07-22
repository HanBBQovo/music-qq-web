"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils/audio-url";
import type { AudioQuality } from "@/lib/api/types";

interface QualityOption {
  value: AudioQuality;
  label: string;
  description: string;
  badge: string;
  isAvailable: boolean;
  isRecommended: boolean;
  fileSize: number;
  sizeText: string;
}

interface QualitySelectorProps {
  currentQuality: AudioQuality;
  availableQualities: AudioQuality[];
  qualitySizes: Record<string, number>;
  recommendedQuality: AudioQuality | null;
  onQualityChange: (quality: AudioQuality) => void;
}

export const QualitySelector = React.memo(function QualitySelector({
  currentQuality,
  availableQualities,
  qualitySizes,
  recommendedQuality,
  onQualityChange,
}: QualitySelectorProps) {
  const generateQualityOptions = (): QualityOption[] => {
    const allQualityOptions: Array<{
      value: AudioQuality;
      label: string;
      description: string;
      badge: string;
    }> = [
      {
        value: "128",
        label: "标准音质",
        description: "MP3 128K",
        badge: "128K",
      },
      { value: "320", label: "高品质", description: "MP3 320K", badge: "320K" },
      {
        value: "flac",
        label: "无损音质",
        description: "FLAC 格式",
        badge: "FLAC",
      },
      {
        value: "ATMOS_2",
        label: "杜比全景声",
        description: "ATMOS 2.0 声道",
        badge: "ATMOS",
      },
      {
        value: "ATMOS_51",
        label: "杜比全景声",
        description: "ATMOS 5.1 声道",
        badge: "ATMOS 5.1",
      },
      {
        value: "MASTER",
        label: "母带音质",
        description: "Hi-Res 母带",
        badge: "MASTER",
      },
    ];

    if (availableQualities.length > 0) {
      return allQualityOptions.map((option) => {
        const isAvailable = availableQualities.includes(option.value);
        const isRecommended = recommendedQuality === option.value;
        const fileSize = qualitySizes[option.value];

        return {
          ...option,
          isAvailable,
          isRecommended,
          fileSize,
          sizeText: fileSize ? formatFileSize(fileSize) : "未知大小",
        };
      });
    }

    return allQualityOptions.map((option) => ({
      ...option,
      isAvailable: true,
      isRecommended: false,
      fileSize: 0,
      sizeText: "未知大小",
    }));
  };

  const qualityOptions = generateQualityOptions();

  const getCurrentQualityLabel = () => {
    const current = qualityOptions.find((q) => q.value === currentQuality);
    return current?.badge || currentQuality.toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          title={`点击切换音质，当前: ${
            qualityOptions.find((q) => q.value === currentQuality)?.label
          }`}
        >
          {getCurrentQualityLabel()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {qualityOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() =>
              option.isAvailable ? onQualityChange(option.value) : undefined
            }
            disabled={!option.isAvailable}
            className={cn(
              "flex flex-col items-start gap-1 py-3 cursor-pointer relative",
              currentQuality === option.value &&
                "bg-accent text-accent-foreground",
              !option.isAvailable && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="font-medium">{option.label}</span>
                {option.isRecommended && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400">
                    推荐
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded",
                  currentQuality === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {option.badge}
              </span>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
              <span className="text-xs text-muted-foreground">
                {option.sizeText}
              </span>
            </div>
            {!option.isAvailable && (
              <span className="text-xs text-red-500 dark:text-red-400">
                此音质不可用
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});