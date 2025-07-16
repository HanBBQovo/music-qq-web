"use client";

import { useState } from "react";
import { usePlayerStore } from "@/lib/store/player";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function UpdateNotification() {
  const isVisible = usePlayerStore((s) => s.isUpdateNoticeVisible);
  const changelog = usePlayerStore((s) => s.updateChangelog);
  const { hideUpdateNotice } = usePlayerStore.getState();

  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);

  const handleRefresh = () => {
    hideUpdateNotice();
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed bottom-5 left-5 z-[9999]"
        >
          <div className="flex w-full max-w-sm items-start gap-4 p-4 bg-background border rounded-xl shadow-lg">
            <div className="flex-shrink-0 pt-1">
              <Sparkles className="h-6 w-6 text-purple-500" />
            </div>

            <div className="flex-1">
              <p className="font-semibold text-foreground">
                站点已更新，焕然一新！
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                刷新页面，即刻体验最新版本。
              </p>

              <Collapsible
                open={isCollapsibleOpen}
                onOpenChange={setIsCollapsibleOpen}
                className="mt-3 w-full"
              >
                <CollapsibleContent className="max-h-32 overflow-y-auto -mr-3 pr-3">
                  <div className="mt-2 mb-3 p-1">
                    <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                      {changelog || "暂无更新说明。"}
                    </p>
                  </div>
                </CollapsibleContent>

                <div className="mt-3 flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button variant="link" className="text-xs p-0 h-auto">
                      {isCollapsibleOpen ? "隐藏详情" : "查看详情"}
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    size="sm"
                    onClick={handleRefresh}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    立即刷新
                  </Button>
                </div>
              </Collapsible>
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={hideUpdateNotice}
                className="p-1 rounded-full hover:bg-muted -m-1"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
