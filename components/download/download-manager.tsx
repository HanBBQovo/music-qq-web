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
  AlertCircle,
  Activity,
  HardDrive,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useDownloadStore } from "@/lib/store/useDownloadStore";
import { type DownloadTask } from "@/lib/api/types";
import { formatFileSize, getQualityDisplayName } from "@/lib/utils/format";
import { ProgressBar } from "@/components/ui/progress-bar";

// Download Statistics Component
function DownloadStatistics() {
  const { tasks } = useDownloadStore();

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

    return {
      totalDownloads: tasks.length,
      completedDownloads: completed.length,
      failedDownloads: failed.length,
      activeDownloads: active.length,
      totalDownloaded,
    };
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
    </div>
  );
}

// Task Row Component
const DownloadTaskRow = React.memo(function DownloadTaskRow({
  task,
}: {
  task: DownloadTask;
}) {
  const taskProgress = useDownloadStore(
    React.useCallback(
      (state) => {
        const progressInfo = state.taskProgress[task.id];
        if (!progressInfo || !progressInfo.totalBytes) return 0;
        return Math.round(
          (progressInfo.bytesLoaded / progressInfo.totalBytes) * 100
        );
      },
      [task.id]
    )
  );

  const pauseTask = useDownloadStore((state) => state.pauseTask);
  const resumeTask = useDownloadStore((state) => state.resumeTask);
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
        removeTask(task.id);
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
              <span className="w-12 text-left">{taskProgress}%</span>
              <span className="flex-1 text-right truncate">
                {formatFileSize(
                  task.totalBytes ? (task.totalBytes * taskProgress) / 100 : 0
                )}{" "}
                / {formatFileSize(task.totalBytes || 0)}
              </span>
            </div>
            <ProgressBar value={taskProgress} className="h-2 w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate">
                {task.status === "downloading"
                  ? "下载中"
                  : task.status === "paused"
                  ? "已暂停"
                  : "等待中"}
              </span>
              <span className="flex-shrink-0">{taskProgress}%</span>
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
});
DownloadTaskRow.displayName = "DownloadTaskRow";

// Mobile Task Card Component
const MobileTaskCard = React.memo(function MobileTaskCard({
  task,
}: {
  task: DownloadTask;
}) {
  const taskProgress = useDownloadStore(
    React.useCallback(
      (state) => {
        const progressInfo = state.taskProgress[task.id];
        if (!progressInfo || !progressInfo.totalBytes) return 0;
        return Math.round(
          (progressInfo.bytesLoaded / progressInfo.totalBytes) * 100
        );
      },
      [task.id]
    )
  );

  const pauseTask = useDownloadStore((state) => state.pauseTask);
  const resumeTask = useDownloadStore((state) => state.resumeTask);
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
        removeTask(task.id);
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
                    {getQualityDisplayName(task.actualQuality || task.quality)}
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
            <span>{taskProgress}%</span>
            <span className="text-muted-foreground">
              {formatFileSize(
                task.totalBytes ? (task.totalBytes * taskProgress) / 100 : 0
              )}{" "}
              / {formatFileSize(task.totalBytes || 0)}
            </span>
          </div>
          <ProgressBar value={taskProgress} className="h-2 w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate">
              {task.status === "downloading"
                ? "下载中"
                : task.status === "paused"
                ? "已暂停"
                : "等待中"}
            </span>
            <span className="flex-shrink-0">{taskProgress}%</span>
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
});
MobileTaskCard.displayName = "MobileTaskCard";

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
          {/* <BatchActions activeTab={activeTab} /> */}
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
