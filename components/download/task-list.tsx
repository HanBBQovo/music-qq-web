"use client";

import * as React from "react";
import { TaskItem } from "./task-item";

// 任务列表组件
export const TaskList = React.memo(function TaskList({
  taskIds,
  emptyMessage,
}: {
  taskIds: string[];
  emptyMessage: string;
}) {
  if (taskIds.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {taskIds.map((taskId) => (
        <TaskItem key={taskId} taskId={taskId} />
      ))}
    </div>
  );
});