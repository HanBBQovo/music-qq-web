"use client";

import * as React from "react";
import {
  Download,
  Pause,
  Play,
  Trash2,
  CheckCircle2,
  X,
  RotateCcw,
  ChevronDown,
  AlertCircle,
  BarChart3,
  Activity,
  HardDrive,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useDownloadStore } from "@/lib/store";
import { type DownloadTask } from "@/lib/api/types";
import { formatFileSize } from "@/lib/utils";

// Helper functions
function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return "0 B/s";

  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  } else if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  } else {
    return `${Math.round(bytesPerSecond)} B/s`;
  }
}

function formatTimeRemaining(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  return `${Math.floor(seconds / 3600)}小时`;
}

function getQualityDisplayName(quality: string): string {
  switch (quality) {
    case "128":
      return "MP3 (128kbps)";
    case "320":
      return "MP3 (320kbps)";
    case "flac":
      return "FLAC 无损";
    case "ATMOS_51":
      return "臻品音质2.0";
    case "ATMOS_2":
      return "臻品全景声2.0";
    case "MASTER":
      return "臻品母带2.0";
    default:
      return quality;
  }
}

// 带动画的进度条组件
function AnimatedProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`h-2 bg-muted w-full rounded-full overflow-hidden ${
        className || ""
      }`}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-primary to-primary/80"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// Download Statistics Component
function DownloadStatistics() {
  const { tasks, downloadSpeeds } = useDownloadStore();

  const stats = React.useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed");
    const failed = tasks.filter((t) => t.status === "error");
    const active = tasks.filter(
      (t) =>
        t.status === "downloading" ||
        t.status === "pending" ||
        t.status === "paused"
    );

    const totalDownloaded = completed.reduce(
      (sum, task) => sum + (task.fileSize || 0),
      0
    );
    const activeSpeeds = Object.values(downloadSpeeds).filter(
      (speed) => speed && speed > 0
    ) as number[];
    const averageSpeed = activeSpeeds.length
      ? activeSpeeds.reduce((sum, speed) => sum + speed, 0) /
        activeSpeeds.length
      : 0;

    return {
      totalDownloads: tasks.length,
      completedDownloads: completed.length,
      failedDownloads: failed.length,
      activeDownloads: active.length,
      totalDownloaded,
      averageSpeed,
    };
  }, [tasks, downloadSpeeds]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">总任务</p>
            <p className="text-xl font-bold">{stats.totalDownloads}</p>
          </div>
          <Download className="h-5 w-5 text-blue-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">进行中</p>
            <p className="text-xl font-bold">{stats.activeDownloads}</p>
          </div>
          <Activity className="h-5 w-5 text-blue-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">已完成</p>
            <p className="text-xl font-bold">{stats.completedDownloads}</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">失败</p>
            <p className="text-xl font-bold">{stats.failedDownloads}</p>
          </div>
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">总下载</p>
            <p className="text-xl font-bold">
              {formatFileSize(stats.totalDownloaded)}
            </p>
          </div>
          <HardDrive className="h-5 w-5 text-purple-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">平均速度</p>
            <p className="text-xl font-bold">
              {formatSpeed(stats.averageSpeed)}
            </p>
          </div>
          <BarChart3 className="h-5 w-5 text-orange-500" />
        </div>
      </Card>
    </div>
  );
}

// Task Row Component
const DownloadTaskRow = React.memo(
  function DownloadTaskRow({ task }: { task: DownloadTask }) {
    // 使用更细粒度的订阅，减少重渲染
    const taskProgress = useDownloadStore(
      React.useCallback(
        (state) => {
          const progressInfo = state.taskProgress[task.id];
          if (!progressInfo) return 0;
          // 量化到整数，减少无意义更新
          return Math.round(progressInfo.progress);
        },
        [task.id]
      )
    );

    // 独立订阅速度，加入防抖
    const speed = useDownloadStore(
      React.useCallback(
        (state) => {
          const currentSpeed = state.downloadSpeeds[task.id];
          // 只有速度变化超过1KB/s或状态改变时才更新
          return currentSpeed || 0;
        },
        [task.id]
      )
    );

    // 独立订阅估算时间
    const estimatedTime = useDownloadStore(
      React.useCallback(
        (state) => {
          const time = state.estimatedTimes[task.id];
          return time || 0;
        },
        [task.id]
      )
    );

    // 独立订阅操作函数
    const pauseTask = useDownloadStore((state) => state.pauseTask);
    const resumeTask = useDownloadStore((state) => state.resumeTask);
    const cancelTask = useDownloadStore((state) => state.cancelTask);
    const retryTask = useDownloadStore((state) => state.retryTask);
    const removeTask = useDownloadStore((state) => state.removeTask);

    const getStatusBadge = (status: DownloadTask["status"]) => {
      switch (status) {
        case "downloading":
          return (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              下载中
            </Badge>
          );
        case "paused":
          return (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              已暂停
            </Badge>
          );
        case "completed":
          return (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              已完成
            </Badge>
          );
        case "error":
          return (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              失败
            </Badge>
          );
        case "pending":
          return (
            <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
              等待中
            </Badge>
          );
      }
    };

    const handleAction = (action: string) => {
      switch (action) {
        case "pause":
          pauseTask(task.id);
          break;
        case "resume":
          resumeTask(task.id);
          break;
        case "cancel":
          cancelTask(task.id);
          break;
        case "retry":
          retryTask(task.id);
          break;
        case "remove":
          removeTask(task.id);
          break;
      }
    };

    return (
      <TableRow className="hover:bg-muted/50">
        <TableCell className="font-medium w-48">
          <div className="max-w-48">
            <p className="font-medium truncate">{task.songName}</p>
            <p className="text-sm text-muted-foreground truncate">
              {task.artist}
            </p>
          </div>
        </TableCell>

        <TableCell className="w-20">
          <div className="text-center">{getStatusBadge(task.status)}</div>
        </TableCell>

        <TableCell className="w-64">
          {task.status === "downloading" || task.status === "paused" ? (
            <div className="space-y-1 w-full">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="w-12 text-left">
                  {taskProgress.toFixed(1)}%
                </span>
                <span className="flex-1 text-right truncate">
                  {formatFileSize(
                    (task.totalBytes || 0) * (taskProgress / 100)
                  )}{" "}
                  / {formatFileSize(task.totalBytes || 0)}
                </span>
              </div>
              <AnimatedProgress value={taskProgress} className="h-2 w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="truncate">
                  {task.status === "downloading"
                    ? formatSpeed(speed)
                    : task.status === "paused"
                    ? "已暂停"
                    : "等待中"}
                </span>
                <span className="flex-shrink-0">
                  {taskProgress.toFixed(1)}%
                  {task.status === "downloading" && estimatedTime > 0 && (
                    <span className="ml-1 text-muted-foreground/70">
                      · 剩余 {formatTimeRemaining(estimatedTime)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          ) : task.status === "error" && task.error ? (
            <div className="text-center px-2 w-full">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-red-600 dark:text-red-400 inline-block leading-relaxed break-words whitespace-normal max-w-full overflow-hidden cursor-help">
                      失败: {task.error}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="break-words whitespace-normal">
                      错误详情: {task.error}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : task.status === "completed" ? (
            <span className="text-sm text-muted-foreground text-center block w-full">
              已完成
            </span>
          ) : (
            <span className="text-sm text-muted-foreground text-center block w-full">
              -
            </span>
          )}
        </TableCell>

        <TableCell className="text-center w-32">
          <div className="flex items-center justify-center gap-1">
            {task.wasDowngraded ? (
              <div className="flex items-center gap-1">
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
                <span className="text-xs text-muted-foreground line-through">
                  {getQualityDisplayName(task.quality)}
                </span>
                <span className="text-xs text-muted-foreground">→</span>
                <span className="text-sm font-medium">
                  {getQualityDisplayName(task.actualQuality || task.quality)}
                </span>
              </div>
            ) : (
              <span className="text-sm">
                {getQualityDisplayName(task.actualQuality || task.quality)}
              </span>
            )}
          </div>
        </TableCell>

        <TableCell className="text-center w-20">
          <span className="text-sm">
            {task.status === "error"
              ? "-"
              : formatFileSize(task.totalBytes || task.fileSize || 0)}
          </span>
        </TableCell>

        <TableCell className="text-center w-24">
          <span className="text-xs text-muted-foreground">
            {task.createdAt
              ? new Date(task.createdAt).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "-"}
          </span>
        </TableCell>

        <TableCell className="w-32">
          <div className="flex items-center justify-center gap-1">
            {task.status === "downloading" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("pause")}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>暂停</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {task.status === "paused" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("resume")}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>继续</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {task.status === "error" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("retry")}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>重试</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {(task.status === "downloading" ||
              task.status === "paused" ||
              task.status === "pending") && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("cancel")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>取消</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {(task.status === "completed" || task.status === "error") && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("remove")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>删除</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  },
  (prevProps, nextProps) => {
    // 更精确的比较函数
    const prev = prevProps.task;
    const next = nextProps.task;

    // 只比较关键属性，进度通过独立订阅获取
    return (
      prev.id === next.id &&
      prev.songName === next.songName &&
      prev.status === next.status &&
      prev.artist === next.artist &&
      prev.wasDowngraded === next.wasDowngraded &&
      prev.error === next.error &&
      prev.totalBytes === next.totalBytes &&
      prev.fileSize === next.fileSize &&
      prev.actualQuality === next.actualQuality
    );
  }
);

// Mobile Task Card Component
const MobileTaskCard = React.memo(
  function MobileTaskCard({ task }: { task: DownloadTask }) {
    // 使用更细粒度的订阅，减少重渲染
    const taskProgress = useDownloadStore(
      React.useCallback(
        (state) => {
          const progressInfo = state.taskProgress[task.id];
          if (!progressInfo) return 0;
          return Math.round(progressInfo.progress);
        },
        [task.id]
      )
    );

    // 独立订阅速度
    const speed = useDownloadStore(
      React.useCallback(
        (state) => {
          const currentSpeed = state.downloadSpeeds[task.id];
          return currentSpeed || 0;
        },
        [task.id]
      )
    );

    // 独立订阅估算时间
    const estimatedTime = useDownloadStore(
      React.useCallback(
        (state) => {
          const time = state.estimatedTimes[task.id];
          return time || 0;
        },
        [task.id]
      )
    );

    // 独立订阅操作函数
    const pauseTask = useDownloadStore((state) => state.pauseTask);
    const resumeTask = useDownloadStore((state) => state.resumeTask);
    const cancelTask = useDownloadStore((state) => state.cancelTask);
    const retryTask = useDownloadStore((state) => state.retryTask);
    const removeTask = useDownloadStore((state) => state.removeTask);

    const getStatusBadge = (status: DownloadTask["status"]) => {
      switch (status) {
        case "downloading":
          return (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              下载中
            </Badge>
          );
        case "paused":
          return (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              已暂停
            </Badge>
          );
        case "completed":
          return (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              已完成
            </Badge>
          );
        case "error":
          return (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              失败
            </Badge>
          );
        case "pending":
          return (
            <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
              等待中
            </Badge>
          );
      }
    };

    const handleAction = (action: string) => {
      switch (action) {
        case "pause":
          pauseTask(task.id);
          break;
        case "resume":
          resumeTask(task.id);
          break;
        case "cancel":
          cancelTask(task.id);
          break;
        case "retry":
          retryTask(task.id);
          break;
        case "remove":
          removeTask(task.id);
          break;
      }
    };

    return (
      <Card className="p-4 space-y-3">
        {/* 头部信息 */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{task.songName}</h4>
            <p className="text-sm text-muted-foreground truncate">
              {task.artist}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(task.status)}
              <div className="flex items-center gap-1">
                {task.wasDowngraded ? (
                  <div className="flex items-center gap-1">
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
                    <span className="text-xs text-muted-foreground line-through">
                      {getQualityDisplayName(task.quality)}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-xs font-medium">
                      {getQualityDisplayName(
                        task.actualQuality || task.quality
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {getQualityDisplayName(task.actualQuality || task.quality)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">
              {task.status === "error"
                ? "-"
                : formatFileSize(task.totalBytes || task.fileSize || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {task.createdAt
                ? new Date(task.createdAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"}
            </div>
          </div>
        </div>

        {/* 进度信息 */}
        {task.status === "downloading" || task.status === "paused" ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{taskProgress.toFixed(1)}%</span>
              <span className="text-muted-foreground">
                {formatFileSize((task.totalBytes || 0) * (taskProgress / 100))}{" "}
                / {formatFileSize(task.totalBytes || 0)}
              </span>
            </div>
            <AnimatedProgress value={taskProgress} className="h-2 w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate">
                {task.status === "downloading"
                  ? formatSpeed(speed)
                  : task.status === "paused"
                  ? "已暂停"
                  : "等待中"}
              </span>
              <span className="flex-shrink-0">
                {taskProgress.toFixed(1)}%
                {task.status === "downloading" && estimatedTime > 0 && (
                  <span className="ml-1 text-muted-foreground/70">
                    · 剩余 {formatTimeRemaining(estimatedTime)}
                  </span>
                )}
              </span>
            </div>
          </div>
        ) : task.status === "error" && task.error ? (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400 break-words whitespace-normal">
            失败: {task.error}
          </div>
        ) : null}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {task.status === "downloading" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("pause")}
              className="flex-1"
            >
              <Pause className="h-3 w-3 mr-1" />
              暂停
            </Button>
          )}

          {task.status === "paused" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("resume")}
              className="flex-1"
            >
              <Play className="h-3 w-3 mr-1" />
              继续
            </Button>
          )}

          {task.status === "error" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("retry")}
              className="flex-1"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              重试
            </Button>
          )}

          {(task.status === "downloading" ||
            task.status === "paused" ||
            task.status === "pending") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("cancel")}
              className="flex-1"
            >
              <X className="h-3 w-3 mr-1" />
              取消
            </Button>
          )}

          {(task.status === "completed" || task.status === "error") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("remove")}
              className="flex-1"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              删除
            </Button>
          )}
        </div>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    // 更精确的比较函数
    const prev = prevProps.task;
    const next = nextProps.task;

    return (
      prev.id === next.id &&
      prev.songName === next.songName &&
      prev.status === next.status &&
      prev.artist === next.artist &&
      prev.wasDowngraded === next.wasDowngraded &&
      prev.error === next.error &&
      prev.totalBytes === next.totalBytes &&
      prev.fileSize === next.fileSize &&
      prev.actualQuality === next.actualQuality
    );
  }
);

// Mobile Task List Component
function MobileTaskList({ tasks }: { tasks: DownloadTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">没有下载任务</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <MobileTaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

// Task Table Component
function DownloadTaskTable({ tasks }: { tasks: DownloadTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">没有下载任务</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">歌曲信息</TableHead>
            <TableHead className="text-center w-20">状态</TableHead>
            <TableHead className="text-center w-64">进度</TableHead>
            <TableHead className="text-center w-32">音质</TableHead>
            <TableHead className="text-center w-20">大小</TableHead>
            <TableHead className="text-center w-24">时间</TableHead>
            <TableHead className="text-center w-32">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <DownloadTaskRow key={task.id} task={task} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Batch Actions Component
function BatchActions({ activeTab }: { activeTab: string }) {
  const {
    tasks,
    pauseAllTasks,
    resumeAllTasks,
    clearCompletedTasks,
    clearErrorTasks,
    clearAllTasks,
    cancelTask,
    retryTask,
  } = useDownloadStore();

  const handleBatchAction = (action: string) => {
    switch (action) {
      case "pauseAll":
        pauseAllTasks();
        break;
      case "resumeAll":
        resumeAllTasks();
        break;
      case "clearCompleted":
        clearCompletedTasks();
        break;
      case "clearFailed":
        clearErrorTasks();
        break;
      case "clearAll":
        clearAllTasks();
        break;
      case "retryAllFailed":
        // 重试所有失败的任务
        tasks
          .filter((t) => t.status === "error")
          .forEach((task) => retryTask(task.id));
        break;
      case "cancelAll":
        // 取消所有进行中的任务
        tasks
          .filter((t) =>
            ["downloading", "pending", "paused"].includes(t.status)
          )
          .forEach((task) => cancelTask(task.id));
        break;
    }
  };

  const getAvailableActions = () => {
    const actions = [];

    if (activeTab === "downloading") {
      actions.push(
        { label: "全部暂停", action: "pauseAll", icon: Pause },
        { label: "全部继续", action: "resumeAll", icon: Play },
        { label: "全部取消", action: "cancelAll", icon: X }
      );
    } else if (activeTab === "completed") {
      actions.push({
        label: "清空已完成",
        action: "clearCompleted",
        icon: Trash2,
      });
    } else if (activeTab === "failed") {
      actions.push(
        { label: "重试全部", action: "retryAllFailed", icon: RotateCcw },
        { label: "清空失败", action: "clearFailed", icon: Trash2 }
      );
    } else {
      // 全部标签页的操作
      actions.push(
        { label: "清空已完成", action: "clearCompleted", icon: Trash2 },
        { label: "清空失败", action: "clearFailed", icon: Trash2 },
        { label: "重试失败", action: "retryAllFailed", icon: RotateCcw },
        {
          label: "清除全部任务",
          action: "clearAll",
          icon: Trash2,
          destructive: true,
        }
      );
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          批量操作
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {availableActions.map(({ label, action, icon: Icon, destructive }) => (
          <DropdownMenuItem
            key={action}
            onClick={() => handleBatchAction(action)}
            className={destructive ? "text-red-600 focus:text-red-600" : ""}
          >
            <Icon className="mr-2 h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Main Download Manager Component
export function DownloadManagerComponent() {
  const { tasks } = useDownloadStore();
  const [activeTab, setActiveTab] = React.useState("all");

  // Filter tasks based on active tab
  const filteredTasks = React.useMemo(() => {
    switch (activeTab) {
      case "downloading":
        return tasks.filter(
          (t) =>
            t.status === "downloading" ||
            t.status === "paused" ||
            t.status === "pending"
        );
      case "completed":
        return tasks.filter((t) => t.status === "completed");
      case "failed":
        return tasks.filter((t) => t.status === "error");
      default:
        return tasks;
    }
  }, [tasks, activeTab]);

  const stats = React.useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed");
    const failed = tasks.filter((t) => t.status === "error");
    const active = tasks.filter(
      (t) =>
        t.status === "downloading" ||
        t.status === "paused" ||
        t.status === "pending"
    );

    return {
      totalDownloads: tasks.length,
      completedDownloads: completed.length,
      failedDownloads: failed.length,
      activeDownloads: active.length,
    };
  }, [tasks]);

  return (
    <div className="w-full space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">下载管理</h1>
        <p className="text-muted-foreground">管理您的音乐下载任务</p>
      </div>

      {/* 统计信息 */}
      <DownloadStatistics />

      <Separator />

      {/* 标签页和批量操作 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-4 sm:flex sm:w-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              全部 ({stats.totalDownloads})
            </TabsTrigger>
            <TabsTrigger value="downloading" className="text-xs sm:text-sm">
              进行中 ({stats.activeDownloads})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs sm:text-sm">
              已完成 ({stats.completedDownloads})
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs sm:text-sm">
              失败 ({stats.failedDownloads})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="w-full sm:w-auto">
          <BatchActions activeTab={activeTab} />
        </div>
      </div>

      {/* 任务列表 - 响应式布局 */}
      <div className="block md:hidden">
        <MobileTaskList tasks={filteredTasks} />
      </div>
      <div className="hidden md:block">
        <DownloadTaskTable tasks={filteredTasks} />
      </div>
    </div>
  );
}
