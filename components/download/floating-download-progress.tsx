"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  X,
  Pause,
  Play,
  ChevronUp,
  ChevronDown,
  Trash,
  RotateCcw,
} from "lucide-react";
import { TabbedPanel } from "@/components/ui/tabbed-panel";
import { Badge } from "@/components/ui/badge";
import { useDownloadStore } from "@/lib/store";
import {
  formatFileSize,
  formatSpeed,
  formatTimeRemaining,
  getQualityDisplayName,
} from "@/lib/utils/format";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useStableSelector } from "@/lib/hooks/useStableSelector";

// Types
interface FloatingDownloadProgressProps {
  className?: string;
  /** 关闭弹窗的回调，由父组件控制显示/隐藏 */
  onClose: () => void;
}

interface DownloadTask {
  id: string;
  songName: string;
  artist: string;
  status: "downloading" | "paused" | "pending" | "completed" | "error";
  progress: number;
  totalBytes?: number;
  fileSize?: number;
  error?: string;
  wasDowngraded?: boolean;
  quality: string;
  actualQuality?: string;
}

// Component
export const FloatingDownloadProgress: React.FC<FloatingDownloadProgressProps> =
  React.memo(function FloatingDownloadProgress({ className, onClose }) {
    // 优化状态订阅，分离频繁变化的状态
    const tasks = useDownloadStore((state) => state.tasks);

    // 分别订阅actions，避免创建新对象导致无限重渲染
    const pauseTask = useDownloadStore((state) => state.pauseTask);
    const resumeTask = useDownloadStore((state) => state.resumeTask);
    const cancelTask = useDownloadStore((state) => state.removeTask);
    const retryTask = useDownloadStore((state) => state.retryTask);
    const removeTask = useDownloadStore((state) => state.removeTask);

    const [isExpanded, setIsExpanded] = React.useState(true);

    // 稳定化任务过滤，避免重复计算导致的渲染问题
    const downloadingItems = React.useMemo(() => {
      return tasks.filter(
        (task) =>
          task.status === "downloading" ||
          task.status === "paused" ||
          task.status === "pending"
      );
    }, [tasks]);

    const completedItems = React.useMemo(() => {
      return tasks.filter((task) => task.status === "completed");
    }, [tasks]);

    const failedItems = React.useMemo(() => {
      // 增强的排序逻辑，兼容没有updatedAt的旧任务
      const getSortTime = (task: any) =>
        new Date(task.updatedAt || task.createdAt).getTime();

      return tasks
        .filter((task) => task.status === "error")
        .sort((a, b) => getSortTime(b) - getSortTime(a));
    }, [tasks]);

    // 稳定化下载数量，添加防抖避免频繁变化
    const downloadCount = React.useMemo(() => {
      const count = downloadingItems.length;
      return count;
    }, [downloadingItems.length]);

    // 获取状态显示名称
    const getStatusText = React.useCallback((status: string) => {
      switch (status) {
        case "downloading":
          return "下载中";
        case "paused":
          return "已暂停";
        case "pending":
          return "等待中";
        case "completed":
          return "已完成";
        case "error":
          return "失败";
        default:
          return status;
      }
    }, []);

    // 简洁优化的样式类
    const getContainerClasses = () => {
      return "fixed bottom-20 right-6 z-50 overflow-hidden rounded-lg shadow-lg bg-background border border-border/80 hover:shadow-xl transition-all duration-300";
    };

    const getHeaderClasses = () => {
      return "flex items-center justify-between p-3 border-b border-border/50";
    };

    const getButtonClasses = () => {
      return "h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-muted";
    };

    // Download item component - 高度优化版本，防止频繁重渲染
    const DownloadItem = React.memo(
      function DownloadItem({
        task,
        onPause,
        onResume,
        onCancel,
        onRetry,
        onRemove,
      }: {
        task: DownloadTask;
        onPause: (id: string) => void;
        onResume: (id: string) => void;
        onCancel: (id: string) => void;
        onRetry: (id: string) => void;
        onRemove: (id: string) => void;
      }) {
        const isActive =
          task.status === "downloading" ||
          task.status === "paused" ||
          task.status === "pending";

        // 独立订阅进度，避免tasks数组变化导致的重渲染
        const taskProgress = useStableSelector(useDownloadStore, (state) => {
          const progressInfo = state.taskProgress[task.id];
          if (!progressInfo || !progressInfo.totalBytes) return 0;
          // 动态计算进度
          return Math.round(
            (progressInfo.bytesLoaded / progressInfo.totalBytes) * 100
          );
        }) as number;

        // 稳定的进度显示，只在整数变化时更新
        const stableProgress = taskProgress;

        return (
          <div className="p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors duration-200">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 mr-3">
                <div className="flex items-center gap-2 mb-1">
                  {/* 状态指示器 */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        task.status === "downloading"
                          ? "bg-primary"
                          : task.status === "paused"
                          ? "bg-yellow-500"
                          : task.status === "completed"
                          ? "bg-green-500"
                          : task.status === "error"
                          ? "bg-red-500"
                          : "bg-gray-400"
                      }`}
                    />
                  </div>
                  <span className="font-medium text-sm truncate max-w-[160px]">
                    {task.songName}
                  </span>
                  <div
                    className={`ml-auto text-xs font-medium px-2 py-1 rounded-md border ${
                      task.status === "completed"
                        ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                        : task.status === "error"
                        ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700"
                        : task.status === "downloading"
                        ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                        : task.status === "paused"
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700"
                        : "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {getStatusText(task.status)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {task.artist} •{" "}
                  {task.status === "error"
                    ? "-"
                    : formatFileSize(task.totalBytes || task.fileSize || 0)}
                  {/* 添加音质显示和降级提示 */}
                  {task.wasDowngraded ? (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span
                        className={`${
                          task.status === "error"
                            ? "text-red-600 dark:text-red-400"
                            : task.status === "completed"
                            ? "text-green-600 dark:text-green-400"
                            : "text-orange-600 dark:text-orange-400"
                        }`}
                        title={
                          task.status === "error"
                            ? "音质降级后仍下载失败"
                            : task.status === "completed"
                            ? "音质已降级但下载成功"
                            : "音质已降级"
                        }
                      >
                        {task.status === "error"
                          ? "✗⚠️"
                          : task.status === "completed"
                          ? "✓⚠️"
                          : "⚠️"}
                      </span>
                      <span className="line-through">
                        {getQualityDisplayName(task.quality)}
                      </span>
                      <span>→</span>
                      <span className="font-medium">
                        {getQualityDisplayName(
                          task.actualQuality || task.quality
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="ml-2">
                      •{" "}
                      {getQualityDisplayName(
                        task.actualQuality || task.quality
                      )}
                    </span>
                  )}
                </div>
                {/* 失败原因单独显示 */}
                {task.status === "error" && task.error && (
                  <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
                    <span className="font-medium">失败原因：</span>
                    {task.error}
                  </div>
                )}
              </div>

              <div className="flex space-x-1">
                {task.status === "downloading" && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPause(task.id);
                    }}
                    className={getButtonClasses()}
                    aria-label="暂停"
                    type="button"
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                )}

                {task.status === "paused" && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onResume(task.id);
                    }}
                    className={getButtonClasses()}
                    aria-label="继续"
                    type="button"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}

                {task.status === "error" && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRetry(task.id);
                    }}
                    className={getButtonClasses()}
                    aria-label="重试"
                    type="button"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}

                {(task.status === "downloading" ||
                  task.status === "paused" ||
                  task.status === "pending") && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(task.id);
                    }}
                    className={getButtonClasses()}
                    aria-label="取消"
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {(task.status === "completed" || task.status === "error") && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(task.id);
                    }}
                    className={getButtonClasses()}
                    aria-label="删除"
                    type="button"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {isActive && (
              <div className="space-y-2 mt-3">
                {/* 进度条 */}
                <div className="relative w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-out ${
                      task.status === "error"
                        ? "bg-red-400"
                        : task.status === "completed"
                        ? "bg-green-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${stableProgress}%` }}
                  >
                    <div className="absolute inset-0 flex items-center justify-end pr-2 text-white text-[10px] font-bold">
                      <span className="flex-shrink-0">{stableProgress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      },
      (prevProps, nextProps) => {
        // 更精确的比较函数 - 减少不必要的重渲染
        const prev = prevProps.task;
        const next = nextProps.task;

        // 只比较关键属性，不比较progress（进度通过独立订阅获取）
        if (
          prev.id !== next.id ||
          prev.songName !== next.songName ||
          prev.status !== next.status ||
          prev.artist !== next.artist ||
          prev.wasDowngraded !== next.wasDowngraded ||
          prev.error !== next.error ||
          prev.totalBytes !== next.totalBytes ||
          prev.fileSize !== next.fileSize ||
          prev.actualQuality !== next.actualQuality
        ) {
          return false;
        }

        // 其他属性相同，不重渲染
        return true;
      }
    );

    return (
      <>
        <AnimatePresence>
          {/*始终渲染弹窗，父组件控制挂载*/}
          <motion.div
            className={getContainerClasses()}
            style={{ width: 350 }}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <div className={getHeaderClasses()}>
              <div className="flex items-center">
                <Download className="h-4 w-4 mr-2" />
                <h3 className="font-medium text-sm">下载管理</h3>
                <Badge className="ml-2" variant="outline">
                  {downloadCount}
                </Badge>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={getButtonClasses()}
                  aria-label={isExpanded ? "收起" : "展开"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={onClose}
                  className={getButtonClasses()}
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <TabbedPanel
                tabs={[
                  {
                    key: "downloading",
                    label: `队列 (${downloadCount})`,
                    render: () =>
                      downloadCount === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          暂无下载任务
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {downloadingItems.map((task) => (
                            <DownloadItem
                              key={task.id}
                              task={task}
                              onPause={pauseTask}
                              onResume={resumeTask}
                              onCancel={cancelTask}
                              onRetry={retryTask}
                              onRemove={removeTask}
                            />
                          ))}
                        </div>
                      ),
                  },
                  {
                    key: "completed",
                    label: `已完成 (${completedItems.length})`,
                    render: () =>
                      completedItems.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          暂无已完成的下载
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {completedItems.map((task) => (
                            <DownloadItem
                              key={task.id}
                              task={task}
                              onPause={pauseTask}
                              onResume={resumeTask}
                              onCancel={cancelTask}
                              onRetry={retryTask}
                              onRemove={removeTask}
                            />
                          ))}
                        </div>
                      ),
                  },
                  {
                    key: "failed",
                    label: `失败 (${failedItems.length})`,
                    render: () =>
                      failedItems.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          暂无失败的下载
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {failedItems.map((task) => (
                            <DownloadItem
                              key={task.id}
                              task={task}
                              onPause={pauseTask}
                              onResume={resumeTask}
                              onCancel={cancelTask}
                              onRetry={retryTask}
                              onRemove={removeTask}
                            />
                          ))}
                        </div>
                      ),
                  },
                ]}
                defaultKey="downloading"
              />
            )}

            {isExpanded && (
              <div className="p-3 border-t border-border/30">
                <div className="flex justify-center items-center w-full">
                  <div className="text-xs flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-blue-500 rounded-full shadow-md animate-pulse"></div>
                      <span className="text-blue-700 dark:text-blue-300 font-bold">
                        {downloadCount} 进行中
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-green-500 rounded-full shadow-md"></div>
                      <span className="text-green-700 dark:text-green-300 font-bold">
                        {completedItems.length} 已完成
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-red-500 rounded-full shadow-md"></div>
                      <span className="text-red-700 dark:text-red-300 font-bold">
                        {failedItems.length} 失败
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </>
    );
  });

// 独立的浮动按钮组件，避免被主组件状态更新影响
const FloatingDownloadButton = React.memo(function FloatingDownloadButton() {
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

  return (
    <>
      <button
        className="btn-float md:bottom-26 bottom-47"
        onClick={() => setIsOpen(true)}
      >
        <Download className="h-6 w-6" />
        {downloadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground pointer-events-none">
            {downloadCount > 9 ? "9+" : downloadCount}
          </Badge>
        )}
      </button>
      {isOpen && <FloatingDownloadProgress onClose={() => setIsOpen(false)} />}
    </>
  );
});

// 导出独立的按钮组件
export { FloatingDownloadButton };
