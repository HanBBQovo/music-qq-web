"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, ChevronUp, ChevronDown } from "lucide-react";
import { TabbedPanel } from "@/components/ui/tabbed-panel";
import { Badge } from "@/components/ui/badge";
import { useDownloadStore } from "@/lib/store";
import { TaskList } from "./task-list";

// Types
interface FloatingDownloadProgressProps {
  onClose: () => void;
}

// 自定义Hook：任务分组逻辑
function useTaskGroups() {
  const tasks = useDownloadStore((state) => state.tasks);

  return React.useMemo(() => {
    const downloading: string[] = [];
    const completed: string[] = [];
    const failed: string[] = [];

    tasks.forEach((task) => {
      if (
        task.status === "downloading" ||
        task.status === "paused" ||
        task.status === "pending"
      ) {
        downloading.push(task.id);
      } else if (task.status === "completed") {
        completed.push(task.id);
      } else if (task.status === "error") {
        failed.push(task.id);
      }
    });

    // 对失败任务按时间排序
    failed.sort((a, b) => {
      const taskA = tasks.find((t) => t.id === a);
      const taskB = tasks.find((t) => t.id === b);
      if (!taskA || !taskB) return 0;
      const timeA = new Date(taskA.updatedAt || taskA.createdAt || 0).getTime();
      const timeB = new Date(taskB.updatedAt || taskB.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return { downloading, completed, failed };
  }, [tasks]);
}

// 样式常量
const STYLES = {
  container: "fixed bottom-20 right-6 z-50 overflow-hidden rounded-lg shadow-lg bg-background border border-border/80 hover:shadow-xl transition-all duration-300",
  header: "flex items-center justify-between p-3 border-b border-border/50",
  button: "h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-muted",
  footer: "p-3 border-t border-border/30",
} as const;

// 主组件
export const FloatingDownloadProgress: React.FC<FloatingDownloadProgressProps> =
  React.memo(function FloatingDownloadProgress({ onClose }) {
    const [isExpanded, setIsExpanded] = React.useState(true);
    const taskGroups = useTaskGroups();
    const downloadCount = taskGroups.downloading.length;

    // 标签页配置
    const tabs = [
      {
        key: "downloading",
        label: `队列 (${downloadCount})`,
        render: () => (
          <TaskList
            taskIds={taskGroups.downloading}
            emptyMessage="暂无下载任务"
          />
        ),
      },
      {
        key: "completed",
        label: `已完成 (${taskGroups.completed.length})`,
        render: () => (
          <TaskList
            taskIds={taskGroups.completed}
            emptyMessage="暂无已完成的下载"
          />
        ),
      },
      {
        key: "failed",
        label: `失败 (${taskGroups.failed.length})`,
        render: () => (
          <TaskList
            taskIds={taskGroups.failed}
            emptyMessage="暂无失败的下载"
          />
        ),
      },
    ];

    // 统计数据
    const stats = [
      { color: "bg-blue-500 animate-pulse", label: "进行中", count: downloadCount, textColor: "text-blue-700 dark:text-blue-300" },
      { color: "bg-green-500", label: "已完成", count: taskGroups.completed.length, textColor: "text-green-700 dark:text-green-300" },
      { color: "bg-red-500", label: "失败", count: taskGroups.failed.length, textColor: "text-red-700 dark:text-red-300" },
    ];

    return (
      <AnimatePresence>
        <motion.div
          className={STYLES.container}
          style={{ width: 350 }}
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          {/* 头部 */}
          <div className={STYLES.header}>
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
                className={STYLES.button}
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
                className={STYLES.button}
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          {isExpanded && (
            <TabbedPanel tabs={tabs} defaultKey="downloading" />
          )}

          {/* 底部统计 */}
          {isExpanded && (
            <div className={STYLES.footer}>
              <div className="flex justify-center items-center w-full">
                <div className="text-xs flex items-center gap-4">
                  {stats.map((stat) => (
                    <span key={stat.label} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 ${stat.color} rounded-full shadow-md`} />
                      <span className={`${stat.textColor} font-bold`}>
                        {stat.count} {stat.label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  });

// 导出按钮组件
export { FloatingDownloadButton } from './floating-download-button';