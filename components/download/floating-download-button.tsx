"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDownloadStore } from "@/lib/store";

// 独立的浮动按钮组件，避免被主组件状态更新影响
export const FloatingDownloadButton = React.memo(function FloatingDownloadButton() {
  const downloadCount = useDownloadStore((state) => {
    const downloadingItems = state.tasks.filter(
      (task) =>
        task.status === "downloading" ||
        task.status === "paused" ||
        task.status === "pending"
    );
    return downloadingItems.length;
  });

  const [isOpen, setIsOpen] = React.useState(false);

  // 懒加载主组件
  const [FloatingDownloadProgress, setFloatingDownloadProgress] = React.useState<React.ComponentType<{ onClose: () => void }> | null>(null);

  React.useEffect(() => {
    if (isOpen && !FloatingDownloadProgress) {
      import('./floating-download-progress').then(module => {
        setFloatingDownloadProgress(() => module.FloatingDownloadProgress);
      });
    }
  }, [isOpen, FloatingDownloadProgress]);

  return (
    <>
      <button
        className="btn-float lg:bottom-26 md:bottom-50 bottom-47"
        onClick={() => setIsOpen(true)}
      >
        <Download className="h-6 w-6" />
        {downloadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground pointer-events-none">
            {downloadCount > 9 ? "9+" : downloadCount}
          </Badge>
        )}
      </button>
      {isOpen && FloatingDownloadProgress && (
        <FloatingDownloadProgress onClose={() => setIsOpen(false)} />
      )}
    </>
  );
});