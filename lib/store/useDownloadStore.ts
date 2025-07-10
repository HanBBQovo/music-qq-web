import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DownloadTask,
  DownloadStatus,
  AudioQuality,
  Song,
  SongUrlInfo,
} from "../api/types";
import {
  formatFileSize,
  getFileSizeByQuality,
  getQualityDisplayName,
  prefetchFileSize,
  getUserDefaultQuality,
  checkBackendHealth,
} from "../download/helpers";
import { downloadSong } from "../download/downloader";
import { v4 as uuidv4 } from "uuid";
import musicApi from "../api/client";
import { useSettingsStore } from "./useSettingsStore";
import { saveAs } from "file-saver";
import { HTTP_HEADERS } from "../constants/http-headers";
import { saveBlob } from "../utils";
import pLimit from "p-limit";

// 定义下载任务进度的数据结构
export interface TaskProgress {
  bytesLoaded: number;
  totalBytes: number;
  lastUpdate: number; // 时间戳，用于节流
}

// 定义下载状态的数据结构
export interface DownloadState {
  tasks: DownloadTask[];
  taskProgress: Record<string, TaskProgress>;
  isDownloading: boolean;
  activeDownloads: Record<string, AbortController>;
  activeStreamReaders: Record<string, ReadableStreamDefaultReader<Uint8Array>>;
  backendLoad: number;
  lastBackendCheck: number | null;
  concurrentDownloadCount: number; // 添加并发控制状态
  addTask: (
    song: Song,
    quality: AudioQuality,
    albumInfo?: { name: string; id: number }
  ) => Promise<void>;
  removeTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  updateTaskStatus: (
    taskId: string,
    status: DownloadStatus,
    error?: string
  ) => void;
  updateTaskProgress: (
    taskId: string,
    progress: number,
    bytesLoaded: number,
    totalBytes: number
  ) => void;
  processQueue: () => void;
  clearCompleted: () => void;
  clearFailed: () => void;
  getTaskById: (taskId: string) => DownloadTask | undefined;
  retryTask: (taskId: string) => void;
  checkBackendHealth: () => Promise<void>;
  updateConcurrentDownloads: (count: number) => void;
  initializeState: () => void;
}

let isStateInitialized = false;

// 使用Zustand创建下载状态管理
export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      tasks: [], // 下载任务列表
      taskProgress: {}, // 任务进度详情
      isDownloading: false, // 是否正在下载
      activeDownloads: {}, // 活跃的下载任务
      activeStreamReaders: {}, // 活跃的流读取器
      backendLoad: 0, // 后端负载百分比
      lastBackendCheck: null, // 上次检查后端健康状况的时间
      concurrentDownloadCount: 2, // 默认并发数为2

      // 更新并发下载数
      updateConcurrentDownloads: (count) => {
        console.log(`[下载管理器] 并发下载数已更新为: ${count}`);
        set({ concurrentDownloadCount: count });
        // 立即尝试处理队列，应用新设置
        get().processQueue();
      },

      // 根据ID获取任务
      getTaskById: (taskId) => {
        return get().tasks.find((task) => task.id === taskId);
      },

      // 添加下载任务
      addTask: async (song, quality, albumInfo) => {
        const { tasks, retryTask } = get();
        const existingTask = tasks.find(
          (t) => t.songMid === song.mid && t.quality === quality
        );

        if (existingTask) {
          // 如果任务已完成或失败，则允许重新下载（通过重试逻辑）
          if (
            existingTask.status === "completed" ||
            existingTask.status === "error"
          ) {
            console.log(
              `[下载管理器] 重新下载已存在任务: ${existingTask.songName}`
            );
            retryTask(existingTask.id);
          } else {
            // 否则，如果任务正在进行中，则提示用户
            console.warn(
              `[下载管理器] 歌曲 "${song.name}" (${quality}) 已在下载队列中，状态为: ${existingTask.status}`
            );
          }
          // 阻止后续代码执行，避免创建新任务
          return;
        }

        const taskId = uuidv4();
        const fileSize = getFileSizeByQuality(song, quality);
        const qualityName = getQualityDisplayName(quality);
        const defaultQuality = getUserDefaultQuality();

        // 预获取文件大小
        const totalBytes =
          (await prefetchFileSize(song.mid, quality || defaultQuality)) || 0;

        const now = new Date();
        const newTask: DownloadTask = {
          id: taskId,
          songId: song.id, // 添加缺失的 songId 属性
          songMid: song.mid,
          songName: song.name,
          artist: song.singer.map((s) => s.name).join(", "),
          albumName: albumInfo?.name || song.album.name,
          albumMid: String(albumInfo?.id || song.album.id),
          cover: song.album.cover,
          status: "pending",
          progress: 0,
          quality: quality || defaultQuality,
          qualityName: qualityName,
          fileSize: totalBytes,
          totalBytes: totalBytes,
          createdAt: now,
          updatedAt: now,
          chunks: [],
          wasDowngraded: false, // 初始状态为未降级
        };

        set((state) => ({
          tasks: [...state.tasks, newTask],
          taskProgress: {
            ...state.taskProgress,
            [taskId]: {
              bytesLoaded: 0,
              totalBytes: totalBytes,
              lastUpdate: 0,
            },
          },
        }));

        console.log(
          `[下载管理器] 已添加新任务: ${
            newTask.songName
          }, 文件大小: ${formatFileSize(newTask.fileSize || 0)}`
        );
        get().processQueue();
      },

      // 移除下载任务
      removeTask: (taskId) => {
        get().pauseTask(taskId); // 先暂停
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          taskProgress: { ...state.taskProgress, [taskId]: undefined as any },
        }));
      },

      // 暂停下载任务
      pauseTask: (taskId) => {
        const { activeDownloads, activeStreamReaders } = get();

        const controller = activeDownloads[taskId];
        if (controller) {
          controller.abort();
          console.log(`[下载管理器] 已中止任务: ${taskId}`);
        }

        const reader = activeStreamReaders[taskId];
        if (reader) {
          reader.cancel().catch((e) => console.warn("Reader cancel error", e));
          console.log(`[下载管理器] 已取消读取器: ${taskId}`);
        }

        get().updateTaskStatus(taskId, "paused");
        get().processQueue();
      },

      // 恢复下载任务
      resumeTask: (taskId) => {
        const task = get().getTaskById(taskId);
        if (task && task.status === "paused") {
          console.log(`[下载管理器] 准备恢复任务: ${taskId}`);
          get().updateTaskStatus(taskId, "pending");
          setTimeout(() => get().processQueue(), 100);
        }
      },

      // 重试失败或重启已完成的任务
      retryTask: (taskId: string) => {
        const task = get().getTaskById(taskId);
        if (task && (task.status === "error" || task.status === "completed")) {
          console.log(`[下载管理器] 准备重试/重启任务: ${taskId}`);

          // 重置任务状态和进度
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, status: "pending", progress: 0, error: undefined }
                : t
            ),
            taskProgress: {
              ...state.taskProgress,
              [taskId]: {
                bytesLoaded: 0,
                totalBytes: task.totalBytes || 0,
                lastUpdate: 0,
              },
            },
          }));

          setTimeout(() => get().processQueue(), 100);
        }
      },

      // 更新任务状态
      updateTaskStatus: (taskId, status, error) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? { ...task, status, error, updatedAt: new Date() }
              : task
          ),
        }));
      },

      // 更新任务进度
      updateTaskProgress: (taskId, progress, bytesLoaded, totalBytes) => {
        set((state) => {
          const newTasks = state.tasks.map((task) =>
            task.id === taskId ? { ...task, progress } : task
          );
          const newTaskProgress = {
            ...state.taskProgress,
            [taskId]: {
              bytesLoaded,
              totalBytes,
              lastUpdate: Date.now(),
            },
          };
          return {
            tasks: newTasks,
            taskProgress: newTaskProgress,
          };
        });
      },

      // 处理下载队列
      processQueue: async () => {
        const {
          tasks,
          activeDownloads,
          updateTaskStatus,
          concurrentDownloadCount,
        } = get();
        const limit = pLimit(concurrentDownloadCount);

        const activeCount = Object.keys(activeDownloads).length;

        const pendingTasks = tasks.filter((task) => task.status === "pending");
        const availableSlots = concurrentDownloadCount - activeCount;

        if (pendingTasks.length === 0 || availableSlots <= 0) {
          return;
        }

        console.log(
          `[下载队列] 待处理: ${pendingTasks.length}, 可用槽位: ${availableSlots}`
        );

        const tasksToProcess = pendingTasks.slice(0, availableSlots);

        const downloadPromises = tasksToProcess.map((task) =>
          limit(() => {
            console.log(`[下载队列] 开始处理任务: ${task.songName}`);
            updateTaskStatus(task.id, "downloading");
            return downloadSong(task, get, set);
          })
        );
        await Promise.all(downloadPromises);
      },

      // 清除已完成的任务
      clearCompleted: () => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.status !== "completed"),
        }));
      },

      // 清除失败的任务
      clearFailed: () => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.status !== "error"),
        }));
      },

      // 后端健康检查
      checkBackendHealth: async () => {
        const result = await checkBackendHealth();
        if (result) {
          set({
            backendLoad: result.backendLoad,
            lastBackendCheck: Date.now(),
          });
        } else {
          set({ lastBackendCheck: Date.now() });
        }
      },

      // 应用启动时，对持久化状态进行一次性初始化检查
      initializeState: () => {
        if (isStateInitialized) return;

        setTimeout(() => {
          const { tasks, pauseTask } = get();
          const downloadingTasks = tasks.filter(
            (task) => task.status === "downloading"
          );

          if (downloadingTasks.length > 0) {
            console.warn(
              `[Store Init] 发现 ${downloadingTasks.length} 个 "downloading" 状态的僵尸任务，将强制恢复为 "paused"`
            );
            downloadingTasks.forEach((task) => {
              // 直接调用内部状态更新，而不是 pauseTask，因为它可能包含不必要的副作用
              set((state) => ({
                tasks: state.tasks.map((t) =>
                  t.id === task.id ? { ...t, status: "paused" } : t
                ),
              }));
            });
          }
          isStateInitialized = true;
        }, 500); // 延迟执行，确保状态已完全从localStorage恢复
      },
    }),
    {
      name: "download-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        taskProgress: state.taskProgress,
        concurrentDownloadCount: state.concurrentDownloadCount,
      }),
    }
  )
);

// 应用加载后立即执行一次状态初始化检查
useDownloadStore.getState().initializeState();
