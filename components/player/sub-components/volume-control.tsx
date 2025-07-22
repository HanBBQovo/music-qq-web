"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from "lucide-react";

interface VolumeControlProps {
  volume: number;
  localVolume: number;
  onVolumeChange: (value: number[]) => void;
  onToggleMute: () => void;
  showSlider?: boolean;
}

export const VolumeControl = React.memo(function VolumeControl({
  volume,
  localVolume,
  onVolumeChange,
  onToggleMute,
  showSlider = true,
}: VolumeControlProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleMute}
        className="h-8 w-8 p-0"
        title={volume > 0 ? "静音" : "取消静音"}
      >
        {volume > 0 ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
      </Button>
      {showSlider && (
        <Slider
          value={[localVolume * 100]}
          onValueChange={onVolumeChange}
          max={100}
          step={1}
          className="w-20"
        />
      )}
    </div>
  );
});