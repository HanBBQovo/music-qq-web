import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song, DownloadTask, AudioQuality, SongUrlInfo } from "../api/types";
import musicApi from "../api/client";
import { generateId, saveBlob } from "../utils";
import { toast } from "sonner";
import { useSettingsStore } from "./useSettingsStore";
import { HTTP_HEADERS } from "@/lib/constants/http-headers";

interface DownloadState {
  // 下载任务列表
  tasks: DownloadTask[];
  // 是否正在下载
  isDownloading: boolean;
  // 同时下载的最大任务数
  maxConcurrentDownloads: number;
  // 活跃的下载请求 - 用于中止下载
  activeDownloads: Record<string, AbortController>;
  // 流式下载读取器 - 用于中断流式下载
  activeStreamReaders: Record<
    string,
    ReadableStreamDefaultReader<Uint8Array> | null
  >;
  // 下载速度信息（字节/秒）
  downloadSpeeds: Record<string, number | undefined>;
  // 速度历史记录（用于加权平均计算）
  speedHistory: Record<
    string,
    Array<{ speed: number; timestamp: number }> | undefined
  >;
  // 预计剩余时间（秒）
  estimatedTimes: Record<string, number | undefined>;
  // 任务进度信息（分离存储，避免tasks数组频繁变化）
  taskProgress: Record<
    string,
    | {
        progress: number;
        bytesLoaded?: number;
        totalBytes?: number;
        lastUpdate?: number;
      }
    | undefined
  >;
  // 临时数据存储（用于断点续传）
  tempDownloadData: Record<
    string,
    { chunks: Uint8Array[]; receivedBytes: number } | undefined
  >;
  // 实时速度计算相关
  lastBytesRecorded: Record<
    string,
    { bytes: number; timestamp: number } | undefined
  >;
  speedUpdateTimer: NodeJS.Timeout | null;
  // 性能监控
  averageSpeed: number; // 平均下载速度
  lastSpeedCheck: number; // 上次速度检查时间
  // 后端负载监控
  backendLoad: number; // 后端负载百分比
  lastBackendCheck: number; // 上次后端检查时间
  adaptiveConcurrent: boolean; // 是否启用自适应并发调整
  // 防止无限循环
  isProcessingQueue: boolean; // 是否正在处理队列

  // 方法
  addTask: (song: Song, quality?: AudioQuality) => Promise<void>;
  addBatchTasks: (songs: Song[], quality?: AudioQuality) => Promise<void>;
  removeTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  pauseAllTasks: () => void;
  resumeAllTasks: () => void;
  cancelTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  clearErrorTasks: () => void;
  clearAllTasks: () => void;
  updateTaskProgress: (
    taskId: string,
    progress: number,
    bytesLoaded?: number,
    totalBytes?: number
  ) => void;
  updateTaskStatus: (
    taskId: string,
    status: DownloadTask["status"],
    error?: string
  ) => void;
  setMaxConcurrentDownloads: (count: number) => void;
  processQueue: () => void;
  setAdaptiveConcurrent: (enabled: boolean) => void;
  startSpeedTimer: () => void;
  stopSpeedTimer: () => void;
}

// 获取用户设置的默认音质
function getUserDefaultQuality(): AudioQuality {
  try {
    const settingsStore = localStorage.getItem("settings-store");
    if (settingsStore) {
      const parsed = JSON.parse(settingsStore);
      return (parsed.state?.defaultQuality as AudioQuality) || "320";
    }
  } catch (error) {
    console.warn("[下载管理器] 获取用户默认音质失败:", error);
  }
  return "320"; // fallback
}

// 预获取文件大小
async function prefetchFileSize(
  songMid: string,
  quality: AudioQuality
): Promise<number | null> {
  try {
    // 获取Cookie
    const cookie = localStorage.getItem("qqmusic_cookie") || "";

    // 检查用户是否启用了元数据处理
    const settings = useSettingsStore.getState();
    const shouldAddMetadata = settings.autoAddMetadata || settings.autoAddCover;

    // 获取下载链接
    const response = await musicApi.getSongUrl({
      mid: songMid,
      quality: quality,
      cookie: cookie,
    });

    if (response.code !== 0 || !response.data?.url) {
      // 改进错误处理逻辑，正确提取后端返回的友好错误信息
      let errorMsg = "获取歌曲下载链接失败";

      if (response.message && response.message !== "success") {
        errorMsg = response.message;
      } else if (response.data?.message) {
        errorMsg = response.data.message;
      }

      console.warn(`[预获取大小] 获取链接失败: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const originalSize = response.data.size || 0;

    // 如果启用了元数据处理，我们无法预测确切的文件大小
    // 因为添加元数据会改变文件大小，所以使用估算值
    if (shouldAddMetadata) {
      // 对于FLAC格式，估算增加约1-5MB的元数据（封面+歌词）
      // 对于MP3格式，估算增加约0.5-2MB的元数据
      const isFlacFormat =
        quality === "MASTER" ||
        quality === "ATMOS_2" ||
        quality === "ATMOS_51" ||
        quality === "flac";
      const metadataEstimate = isFlacFormat ? 3 * 1024 * 1024 : 1 * 1024 * 1024; // 3MB for FLAC, 1MB for MP3

      const estimatedSize = originalSize + metadataEstimate;
      return estimatedSize;
    }

    // 使用HEAD请求获取文件大小（不添加元数据的情况）
    const sizeResult = await musicApi.getFileSize(response.data.url);

    if (sizeResult.size) {
      return sizeResult.size;
    } else {
      console.warn(`[预获取大小] HEAD请求失败: ${sizeResult.error}`);
      return originalSize > 0 ? originalSize : null;
    }
  } catch (error) {
    console.error(`[预获取大小] 预获取文件大小异常:`, error);
    return null;
  }
}

// 格式化文件大小的辅助函数
function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 根据音质获取文件大小
function getFileSizeByQuality(song: Song, quality: AudioQuality): number {
  if (
    quality === "flac" ||
    quality === "ATMOS_2" ||
    quality === "MASTER" ||
    quality === "ATMOS_51"
  ) {
    return song.size.sizeflac || 0;
  } else if (quality === "320") {
    return song.size.size320 || 0;
  } else if (quality === "128") {
    return song.size.size128 || 0;
  } else {
    return 0;
  }
}

// 获取音质显示名称的辅助函数
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

// 后端健康检查函数
async function checkBackendHealth() {
  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_API_URL + "/api/stream/health",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const healthData = await response.json();
      const loadPercentage = healthData.load?.load_percentage || 0;

      // 更新后端负载信息
      useDownloadStore.setState(() => ({
        backendLoad: loadPercentage,
        lastBackendCheck: Date.now(),
      }));
    }
  } catch (error) {
    console.warn("[下载管理器] 后端健康检查失败:", error);
    useDownloadStore.setState(() => ({
      lastBackendCheck: Date.now(),
    }));
  }
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      // 初始状态
      tasks: [],
      isDownloading: false,
      maxConcurrentDownloads: 2,
      activeDownloads: {},
      activeStreamReaders: {},
      downloadSpeeds: {},
      speedHistory: {},
      estimatedTimes: {},
      taskProgress: {},
      tempDownloadData: {},
      lastBytesRecorded: {},
      speedUpdateTimer: null,
      averageSpeed: 0,
      lastSpeedCheck: 0,
      backendLoad: 0,
      lastBackendCheck: 0,
      adaptiveConcurrent: true,
      isProcessingQueue: false,

      // 添加下载任务
      addTask: async (song: Song, quality?: AudioQuality) => {
        // 获取当前状态
        const { tasks } = get();
        const selectedQuality: AudioQuality =
          quality || getUserDefaultQuality();

        // 防重复处理：检查是否在短时间内重复调用
        const now = Date.now();
        const requestKey = `${song.mid}-${selectedQuality}`;
        const lastRequestTime = (globalThis as any).__lastAddTaskTime__ || {};

        if (
          lastRequestTime[requestKey] &&
          now - lastRequestTime[requestKey] < 500
        ) {
          return;
        }

        // 记录本次请求时间
        (globalThis as any).__lastAddTaskTime__ = {
          ...lastRequestTime,
          [requestKey]: now,
        };

        // 生成唯一任务ID（包含时间戳确保唯一性）
        const taskId = `${song.mid}-${selectedQuality}-${now}`;

        // 创建新任务（先用估算大小）
        const estimatedSize = getFileSizeByQuality(song, selectedQuality);

        const newTask: DownloadTask = {
          id: taskId,
          songId: song.id,
          songMid: song.mid,
          songName: song.name,
          artist: song.singer.map((s) => s.name).join(", "),
          albumName: song.album.name,
          albumMid: song.album.mid,
          quality: selectedQuality,
          progress: 0,
          status: "pending",
          createdAt: new Date(),
          fileSize: estimatedSize,
          totalBytes: estimatedSize,
        };

        // 添加任务
        set((state) => ({
          tasks: [newTask, ...state.tasks],
        }));

        toast.success(`已添加下载任务: ${song.name}`);

        // 异步预获取文件大小，优先级更高
        prefetchFileSize(song.mid, selectedQuality)
          .then((actualSize) => {
            if (actualSize && actualSize !== estimatedSize) {
              // 更新任务的文件大小
              set((state) => ({
                tasks: state.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        fileSize: actualSize,
                        totalBytes: actualSize,
                      }
                    : task
                ),
              }));
            } else if (!actualSize && estimatedSize === 0) {
              // 如果预获取失败且估算大小也是0，设置一个默认值
              const defaultSize =
                selectedQuality === "flac" || selectedQuality === "MASTER"
                  ? 50 * 1024 * 1024
                  : 10 * 1024 * 1024;

              set((state) => ({
                tasks: state.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        fileSize: defaultSize,
                        totalBytes: defaultSize,
                      }
                    : task
                ),
              }));
            }
          })
          .catch((error) => {
            console.warn(`[更新大小] 预获取文件大小失败:`, error);
          });

        // 处理队列
        get().processQueue();
      },

      // 批量添加下载任务
      addBatchTasks: async (songs: Song[], quality?: AudioQuality) => {
        const selectedQuality = quality || getUserDefaultQuality();
        const existingTasks = get().tasks;

        // 过滤掉已存在的任务（包含所有状态）
        const newSongs = songs.filter((song) => {
          const taskId = `${song.mid}-${selectedQuality}`;
          return !existingTasks.some((task) => task.id === taskId);
        });

        if (newSongs.length === 0) return;

        // 创建新任务
        const newTasks: DownloadTask[] = newSongs.map((song) => ({
          id: `${song.mid}-${selectedQuality}`, // 使用固定ID
          songId: song.id,
          songMid: song.mid,
          songName: song.name,
          artist: song.singer.map((s) => s.name).join(", "),
          albumName: song.album.name,
          albumMid: song.album.mid,
          quality: selectedQuality,
          progress: 0,
          status: "pending",
          createdAt: new Date(),
        }));

        // 批量添加到任务列表
        set((state) => ({
          tasks: [...state.tasks, ...newTasks],
        }));

        // 处理下载队列
        setTimeout(() => {
          get().processQueue();
        }, 100);
      },

      // 移除下载任务
      removeTask: (taskId: string) => {
        const { activeDownloads } = get();

        // 如果任务正在下载，先中止下载 - 添加安全检查
        if (activeDownloads[taskId]) {
          try {
            activeDownloads[taskId].abort();
          } catch (error) {
            console.warn(`[下载管理器] 中止下载请求失败:`, error);
          }
          const newActiveDownloads = { ...activeDownloads };
          delete newActiveDownloads[taskId];
          set({ activeDownloads: newActiveDownloads });
        }

        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          downloadSpeeds: {
            ...state.downloadSpeeds,
            [taskId]: undefined,
          },
          speedHistory: {
            ...state.speedHistory,
            [taskId]: undefined,
          },
          estimatedTimes: {
            ...state.estimatedTimes,
            [taskId]: undefined,
          },
          taskProgress: {
            ...state.taskProgress,
            [taskId]: undefined,
          },
        }));
      },

      // 暂停下载任务
      pauseTask: (taskId: string) => {
        const { activeDownloads, activeStreamReaders } = get();

        // 中止下载请求
        if (activeDownloads[taskId]) {
          const controller = activeDownloads[taskId];
          if (controller && typeof controller.abort === "function") {
            try {
              controller.abort();
            } catch (error) {
              // 静默处理
            }
          }

          const newActiveDownloads = { ...activeDownloads };
          delete newActiveDownloads[taskId];
          set({ activeDownloads: newActiveDownloads });
        }

        // 中止流式读取器
        if (activeStreamReaders[taskId]) {
          const reader = activeStreamReaders[taskId];
          if (reader && typeof reader.cancel === "function") {
            try {
              reader.cancel("用户暂停下载");
            } catch (error) {
              // 静默处理
            }
          }

          const newActiveStreamReaders = { ...activeStreamReaders };
          delete newActiveStreamReaders[taskId];
          set({ activeStreamReaders: newActiveStreamReaders });
        }

        // 更新任务状态 - 保留进度和断点续传数据
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId && task.status === "downloading"
              ? { ...task, status: "paused" }
              : task
          ),
          downloadSpeeds: {
            ...state.downloadSpeeds,
            [taskId]: 0,
          },
          speedHistory: {
            ...state.speedHistory,
            [taskId]: undefined,
          },
          estimatedTimes: {
            ...state.estimatedTimes,
            [taskId]: undefined,
          },
          // ✅ 保留进度和断点续传数据，不要清除
          // tempDownloadData: 保持不变
          // taskProgress: 保持不变
        }));

        // 处理下载队列
        setTimeout(() => {
          get().processQueue();
        }, 100);
      },

      // 恢复下载任务
      resumeTask: (taskId: string) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId && task.status === "paused"
              ? { ...task, status: "pending" }
              : task
          ),
        }));
        // 处理下载队列
        setTimeout(() => {
          get().processQueue();
        }, 100);
      },

      // 暂停所有下载任务
      pauseAllTasks: () => {
        const { activeDownloads } = get();

        // 中止所有下载请求
        Object.values(activeDownloads).forEach((controller) => {
          controller.abort();
        });

        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.status === "downloading" || task.status === "pending"
              ? { ...task, status: "paused" }
              : task
          ),
          activeDownloads: {},
          isDownloading: false,
        }));

        // 停止实时速度计算
        get().stopSpeedTimer();
      },

      // 恢复所有暂停的任务
      resumeAllTasks: () => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.status === "paused" ? { ...task, status: "pending" } : task
          ),
        }));

        // 处理下载队列
        setTimeout(() => {
          get().processQueue();
        }, 100);
      },

      // 取消下载任务
      cancelTask: (taskId: string) => {
        const { activeDownloads } = get();

        // 中止下载请求 - 添加安全检查
        if (activeDownloads[taskId]) {
          try {
            activeDownloads[taskId].abort();
          } catch (error) {
            console.warn(`[下载管理器] 中止下载请求失败:`, error);
          }
          const newActiveDownloads = { ...activeDownloads };
          delete newActiveDownloads[taskId];
          set({ activeDownloads: newActiveDownloads });
        }

        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId &&
            ["downloading", "pending", "paused"].includes(task.status)
              ? { ...task, status: "error", error: "用户取消下载" }
              : task
          ),
          downloadSpeeds: {
            ...state.downloadSpeeds,
            [taskId]: 0,
          },
          speedHistory: {
            ...state.speedHistory,
            [taskId]: undefined,
          },
          estimatedTimes: {
            ...state.estimatedTimes,
            [taskId]: undefined,
          },
          tempDownloadData: {
            ...state.tempDownloadData,
            [taskId]: undefined,
          },
          taskProgress: {
            ...state.taskProgress,
            [taskId]: undefined,
          },
        }));

        // 处理下载队列
        setTimeout(() => {
          get().processQueue();
        }, 100);
      },

      // 重试下载任务
      retryTask: (taskId: string) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId && task.status === "error"
              ? {
                  ...task,
                  status: "pending",
                  progress: 0,
                  error: undefined,
                  lastProgressUpdate: undefined,
                  lastBytesLoaded: undefined,
                }
              : task
          ),
          downloadSpeeds: {
            ...state.downloadSpeeds,
            [taskId]: undefined,
          },
          speedHistory: {
            ...state.speedHistory,
            [taskId]: undefined,
          },
          estimatedTimes: {
            ...state.estimatedTimes,
            [taskId]: undefined,
          },
          tempDownloadData: {
            ...state.tempDownloadData,
            [taskId]: undefined,
          },
          taskProgress: {
            ...state.taskProgress,
            [taskId]: undefined,
          },
        }));

        // 重新处理下载队列
        setTimeout(() => {
          get().processQueue();
        }, 100);

        toast.success("任务已重新加入下载队列");
      },

      // 清除已完成的任务
      clearCompletedTasks: () => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.status !== "completed"),
        }));
      },

      // 清除错误的任务
      clearErrorTasks: () => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.status !== "error"),
        }));
      },

      // 清除所有任务
      clearAllTasks: () => {
        const { activeDownloads } = get();

        // 中止所有下载请求
        Object.values(activeDownloads).forEach((controller) => {
          controller.abort();
        });

        set({
          tasks: [],
          activeDownloads: {},
          downloadSpeeds: {},
          speedHistory: {},
          estimatedTimes: {},
          isDownloading: false,
          tempDownloadData: {},
          taskProgress: {},
        });
      },

      // 更新任务进度
      updateTaskProgress: (
        taskId: string,
        progress: number,
        bytesLoaded?: number,
        totalBytes?: number
      ) => {
        const now = Date.now();

        set((state) => {
          // 更新独立的进度存储，避免tasks数组频繁变化
          const newTaskProgress = {
            ...state.taskProgress,
            [taskId]: {
              progress,
              bytesLoaded,
              totalBytes,
              lastUpdate: now,
            },
          };

          // 优化时间估算计算 - 减少频繁更新
          const newEstimatedTimes = { ...state.estimatedTimes };

          if (bytesLoaded !== undefined && totalBytes) {
            // 根据当前速度计算预计剩余时间
            const currentSpeed = state.downloadSpeeds[taskId] || 0;
            if (currentSpeed > 0 && bytesLoaded < totalBytes) {
              const remainingBytes = totalBytes - bytesLoaded;
              const estimatedTime = remainingBytes / currentSpeed; // 秒

              // 只有时间变化超过3秒才更新（减少频繁变化）
              const currentTime = state.estimatedTimes[taskId] || 0;
              if (Math.abs(estimatedTime - currentTime) > 3) {
                newEstimatedTimes[taskId] = estimatedTime;
              }
            } else {
              newEstimatedTimes[taskId] = 0;
            }
          }

          return {
            taskProgress: newTaskProgress,
            estimatedTimes: newEstimatedTimes,
          };
        });
      },

      // 更新任务状态
      updateTaskStatus: (
        taskId: string,
        status: DownloadTask["status"],
        error?: string
      ) => {
        const { activeDownloads, isProcessingQueue } = get();

        // 更新任务
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status,
                  error: error || undefined,
                  completedAt:
                    status === "completed" ? new Date() : task.completedAt,
                }
              : task
          ),
        }));

        // 清理相关的活跃下载状态
        if (
          status === "completed" ||
          status === "error" ||
          status === "paused"
        ) {
          delete activeDownloads[taskId];
        }

        // 如果有任务完成或者出错，且不在处理队列中，则处理下载队列
        if (
          (status === "completed" || status === "error") &&
          !isProcessingQueue
        ) {
          setTimeout(() => {
            get().processQueue();
          }, 50);
        }
      },

      // 设置最大同时下载数
      setMaxConcurrentDownloads: (count: number) => {
        set({ maxConcurrentDownloads: count });
      },

      // 处理下载队列
      processQueue: () => {
        const {
          tasks,
          maxConcurrentDownloads,
          downloadSpeeds,
          averageSpeed,
          lastSpeedCheck,
          lastBackendCheck,
          adaptiveConcurrent,
          isProcessingQueue,
        } = get();

        if (isProcessingQueue) {
          return;
        }

        // 获取正在下载的任务数量
        const downloadingTasks = tasks.filter(
          (task) => task.status === "downloading"
        );

        // 如果已经达到最大同时下载数，则不处理
        if (downloadingTasks.length >= maxConcurrentDownloads) return;

        // 获取等待下载的任务
        const pendingTasks = tasks.filter((task) => task.status === "pending");

        // 如果没有等待的任务，则不处理
        if (pendingTasks.length === 0) {
          if (downloadingTasks.length === 0) {
            set({ isDownloading: false });
          }
          return;
        }

        // 设置下载状态
        set({ isDownloading: true, isProcessingQueue: true });

        // 启动实时速度计算
        get().startSpeedTimer();

        // 计算可以开始下载的任务数量
        const availableSlots = maxConcurrentDownloads - downloadingTasks.length;
        const tasksToStart = pendingTasks.slice(0, availableSlots);

        // 开始下载任务
        tasksToStart.forEach((task) => {
          const { updateTaskStatus } = get();

          // 更新任务状态为下载中
          updateTaskStatus(task.id, "downloading");

          // 获取下载链接并开始下载
          downloadSong(task)
            .then(() => {
              // 检查任务状态，只有还是downloading时才认为是正常完成
              const currentState = get();
              const currentTask = currentState.tasks.find(
                (t) => t.id === task.id
              );
              if (currentTask?.status === "downloading") {
                // 任务正常完成
              } else {
                // 任务状态已变更，跳过完成处理
              }
            })
            .catch((error) => {
              // 检查任务当前状态，如果已经被暂停、取消等，不标记为错误
              const currentState = get();
              const currentTask = currentState.tasks.find(
                (t) => t.id === task.id
              );

              // 如果任务已经不是downloading状态，说明是用户主动操作导致的中止
              if (currentTask && currentTask.status !== "downloading") {
                return;
              }

              // ✅ 增强网络中断错误识别和处理
              const isNetworkInterruption =
                error instanceof Error &&
                (error.name === "AbortError" ||
                  error.name === "TypeError" ||
                  error.message?.includes("Failed to fetch") ||
                  error.message?.includes("NetworkError") ||
                  error.message?.includes("network") ||
                  error.message?.includes("Connection") ||
                  error.message?.includes("The user aborted a request"));

              // 如果是网络中断（包括页面刷新），优雅处理，不抛出错误
              if (isNetworkInterruption) {
                console.log(
                  `[下载管理器] 网络中断处理: ${task.songName}, 错误类型: ${error.name}, 消息: ${error.message}`
                );

                // 如果任务还是downloading状态，标记为暂停
                if (currentTask?.status === "downloading") {
                  useDownloadStore
                    .getState()
                    .updateTaskStatus(task.id, "paused");
                }

                return; // 不抛出错误，优雅退出
              }

              // 检查任务是否已经被标记为其他状态（避免重复处理）
              if (
                currentTask &&
                (currentTask.status === "completed" ||
                  currentTask.status === "error")
              ) {
                return;
              }

              // 只有真正的业务错误才标记为error
              console.warn(
                `[下载管理器] 下载任务失败: ${task.songName}, 错误: ${error.name} - ${error.message}`
              );
              updateTaskStatus(task.id, "error", error.message || "下载失败");
            });
        });

        // 检查后端负载状况（每分钟检查一次）
        const currentTime = Date.now();
        if (currentTime - lastBackendCheck > 60000) {
          checkBackendHealth().finally(() => {
            set({ lastBackendCheck: currentTime });
          });
        }

        // 处理完成后重置队列状态
        setTimeout(() => {
          set({ isProcessingQueue: false });
        }, 100);
      },

      // 设置自适应并发调整
      setAdaptiveConcurrent: (enabled: boolean) => {
        set({ adaptiveConcurrent: enabled });
      },

      // 开始实时速度计算 - 优化版本，减少频繁更新
      startSpeedTimer: () => {
        const { speedUpdateTimer } = get();
        if (speedUpdateTimer) return;

        const timer = setInterval(() => {
          const { tasks, tempDownloadData, lastBytesRecorded } = get();
          const now = Date.now();
          const newDownloadSpeeds: Record<string, number | undefined> = {};
          const newLastBytesRecorded: Record<
            string,
            { bytes: number; timestamp: number } | undefined
          > = { ...lastBytesRecorded };

          let shouldUpdate = false;

          // 检查是否还有正在下载的任务
          const downloadingTasks = tasks.filter(
            (task) => task.status === "downloading"
          );

          if (downloadingTasks.length === 0) {
            get().stopSpeedTimer();
            return;
          }

          // 检查每个正在下载的任务
          downloadingTasks.forEach((task) => {
            const currentData = tempDownloadData[task.id];
            const lastRecord = lastBytesRecorded[task.id];

            if (currentData) {
              const currentBytes = currentData.receivedBytes;

              if (lastRecord) {
                const timeDiff = (now - lastRecord.timestamp) / 1000; // 秒
                const bytesDiff = currentBytes - lastRecord.bytes;

                if (timeDiff >= 1.0) {
                  // 改为1秒检查一次，平衡性能和响应性
                  const speed = bytesDiff / timeDiff; // 字节/秒
                  const currentSpeed = get().downloadSpeeds[task.id] || 0;

                  // 只有速度变化超过50KB/s才更新（减少无意义更新）
                  const speedThreshold = 50 * 1024; // 50KB/s
                  if (
                    Math.abs(speed - currentSpeed) > speedThreshold ||
                    currentSpeed === 0
                  ) {
                    // 平滑速度，避免剧烈波动
                    const smoothedSpeed =
                      currentSpeed > 0
                        ? Math.round(currentSpeed * 0.6 + speed * 0.4)
                        : speed;

                    newDownloadSpeeds[task.id] = Math.max(0, smoothedSpeed);
                    shouldUpdate = true;
                  } else {
                    // 速度变化不大，保持当前速度
                    newDownloadSpeeds[task.id] = currentSpeed;
                  }

                  newLastBytesRecorded[task.id] = {
                    bytes: currentBytes,
                    timestamp: now,
                  };
                } else {
                  // 时间间隔不够，保持当前速度
                  const currentSpeed = get().downloadSpeeds[task.id] || 0;
                  newDownloadSpeeds[task.id] = currentSpeed;
                }
              } else {
                // 首次记录
                newLastBytesRecorded[task.id] = {
                  bytes: currentBytes,
                  timestamp: now,
                };
                newDownloadSpeeds[task.id] = 0;
              }
            }
          });

          // 只在有显著变化时才更新状态
          if (shouldUpdate || Object.keys(newDownloadSpeeds).length > 0) {
            set((state) => ({
              downloadSpeeds: {
                ...state.downloadSpeeds,
                ...newDownloadSpeeds,
              },
              lastBytesRecorded: newLastBytesRecorded,
            }));
          }
        }, 800); // 改为每0.8秒执行一次，平衡性能和响应性

        set({ speedUpdateTimer: timer });
      },

      // 停止实时速度计算
      stopSpeedTimer: () => {
        const { speedUpdateTimer } = get();
        if (speedUpdateTimer) {
          clearInterval(speedUpdateTimer);
          set({
            speedUpdateTimer: null,
            lastBytesRecorded: {},
          });
        }
      },
    }),
    {
      name: "download-store", // localStorage存储的键名
      partialize: (state) => ({
        tasks: state.tasks.map((task) => ({
          ...task,
          // 移除不需要持久化的临时属性
          lastProgressUpdate: undefined,
          lastBytesLoaded: undefined,
        })),
        maxConcurrentDownloads: state.maxConcurrentDownloads,
        adaptiveConcurrent: state.adaptiveConcurrent,
        // ✅ 只持久化进度数据，不持久化tempDownloadData（避免localStorage配额超出）
        taskProgress: state.taskProgress,
        // ❌ 移除tempDownloadData持久化，因为包含大量二进制数据会超出localStorage限制
      }),
      // 页面刷新后的状态恢复
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 检查是否有downloading状态的任务
          const downloadingTasks = state.tasks.filter(
            (task) => task.status === "downloading"
          );

          // 将所有"downloading"状态的任务改为"paused"
          const recoveredTasks = state.tasks.map((task) => {
            if (task.status === "downloading") {
              return {
                ...task,
                status: "paused" as const,
                lastProgressUpdate: undefined,
                lastBytesLoaded: undefined,
              };
            }
            return task;
          });

          // 清理所有临时状态，保留进度数据
          const cleanState = {
            ...state,
            tasks: recoveredTasks,
            isDownloading: false,
            activeDownloads: {},
            downloadSpeeds: {},
            speedHistory: {},
            estimatedTimes: {},
            // ✅ 保留进度数据
            taskProgress: state.taskProgress || {},
            // ❌ 不恢复tempDownloadData，使用基于进度的断点续传
            tempDownloadData: {},
            isProcessingQueue: false,
          };

          // ✅ 立即检查和强制恢复，不等待1秒
          setTimeout(() => {
            const currentTasks = useDownloadStore.getState().tasks;
            const stillDownloading = currentTasks.filter(
              (task) => task.status === "downloading"
            );
            const errorTasks = currentTasks.filter(
              (task) =>
                task.status === "error" &&
                downloadingTasks.some((dt) => dt.id === task.id) // 是原本正在下载的任务
            );

            if (stillDownloading.length > 0 || errorTasks.length > 0) {
              console.log(
                `[下载管理器] 页面刷新恢复: ${stillDownloading.length}个downloading任务, ${errorTasks.length}个误标记error任务`
              );

              useDownloadStore.setState((currentState) => ({
                tasks: currentState.tasks.map((task) => {
                  // 强制将downloading或误标记的error任务恢复为paused
                  if (
                    task.status === "downloading" ||
                    (task.status === "error" &&
                      downloadingTasks.some((dt) => dt.id === task.id))
                  ) {
                    return {
                      ...task,
                      status: "paused" as const,
                      error: undefined,
                    };
                  }
                  return task;
                }),
                isDownloading: false,
                activeDownloads: {},
                downloadSpeeds: {},
                speedHistory: {},
                estimatedTimes: {},
                tempDownloadData: {},
              }));
            }

            // ✅ 恢复后打印状态信息，方便调试
            const { tasks, taskProgress } = useDownloadStore.getState();
            const pausedTasks = tasks.filter(
              (task) => task.status === "paused"
            );
            if (pausedTasks.length > 0) {
              console.log(
                `[下载管理器] 恢复了 ${pausedTasks.length} 个暂停任务:`
              );
              pausedTasks.forEach((task) => {
                const progress = taskProgress[task.id]?.progress || 0;
                console.log(
                  `  - ${task.songName}: 进度 ${progress.toFixed(
                    1
                  )}%（基于进度的断点续传）`
                );
              });
            }
          }, 200); // 减少延时到200ms，更快恢复

          return cleanState;
        }
        return state;
      },
    }
  )
);

// 下载歌曲的辅助函数
async function downloadSong(task: DownloadTask): Promise<void> {
  try {
    // 创建中止控制器
    const abortController = new AbortController();

    // 将中止控制器添加到活跃下载中
    useDownloadStore.setState((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [task.id]: abortController,
      },
    }));

    // 获取歌曲URL
    const response = await musicApi.getSongUrl({
      mid: task.songMid,
      quality: task.quality,
      cookie: localStorage.getItem("qqmusic_cookie") || "",
      enableFallback: useSettingsStore.getState().enableQualityFallback,
    });

    if (response.code !== 0 || !response.data?.url) {
      // 改进错误处理逻辑，正确提取后端返回的友好错误信息
      let errorMsg = "获取歌曲下载链接失败";

      if (response.message && response.message !== "success") {
        errorMsg = response.message;
      } else if (response.data?.message) {
        errorMsg = response.data.message;
      }

      console.warn(`[预获取大小] 获取链接失败: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 确保response.data存在后再访问其属性
    const songUrl: SongUrlInfo = response.data;
    if (!songUrl.url) {
      throw new Error("获取到的下载链接为空");
    }

    // 检查是否发生了音质降级并更新任务信息
    const actualQuality = songUrl.actualQuality || task.quality;
    const wasDowngraded = !!(
      songUrl.actualQuality && songUrl.actualQuality !== task.quality
    );

    // 立即更新任务的音质信息
    useDownloadStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              actualQuality: actualQuality as AudioQuality,
              wasDowngraded: wasDowngraded,
            }
          : t
      ),
    }));

    // 获取设置
    const settings = useSettingsStore.getState();
    const shouldAddMetadata = settings.autoAddMetadata || settings.autoAddCover;

    // 开始下载歌曲
    const streamUrl = musicApi.getStreamUrl(
      songUrl.url || "",
      task.songMid,
      task.songName,
      task.artist,
      task.albumMid,
      shouldAddMetadata
    );

    // 为URL对象添加redirect参数
    const finalUrl = new URL(streamUrl);
    finalUrl.searchParams.append("redirect", "true");

    // 使用fetch API下载歌曲，添加Cookie头
    const storedCookie = localStorage.getItem("qqmusic_cookie") || "";

    // 获取当前任务的已下载数据
    const downloadState = useDownloadStore.getState();

    // ✅ 基于进度的断点续传：使用taskProgress计算已下载字节数
    const progressInfo = downloadState.taskProgress[task.id];
    let startByte = 0;

    if (progressInfo && progressInfo.progress > 0 && task.totalBytes) {
      // 根据进度百分比计算已下载的字节数
      startByte = Math.floor((progressInfo.progress / 100) * task.totalBytes);
      console.log(
        `[基于进度的断点续传] 任务 ${task.songName}: 进度 ${progressInfo.progress}%, 计算起始字节 ${startByte}`
      );
    }

    // 构建请求头 - 不包含x-qq-cookie以避免CORS问题
    const headers: Record<string, string> = {
      // 当使用redirect=true时，不发送敏感头，避免CORS问题
    };

    // 添加Range头实现断点续传
    if (startByte > 0) {
      headers["Range"] = `bytes=${startByte}-`;
      console.log(
        `[断点续传] 任务 ${task.songName}: 从字节 ${startByte} 开始下载`
      );
      console.log(`[断点续传] Range头: ${headers["Range"]}`);
    } else {
      console.log(`[断点续传] 任务 ${task.songName}: 从头开始下载`);
    }

    console.log(`[下载] 发送请求到: ${finalUrl}`);

    // 不重置起始字节，保持断点续传位置
    // startByte = 0;

    // 设置超时处理 - 为MASTER音质设置更长超时时间
    const isMasterQuality = task.quality === "MASTER";
    const downloadTimeout = isMasterQuality ? 600000 : 180000; // MASTER: 10分钟，其他: 3分钟
    const timeoutLabel = isMasterQuality ? "10分钟" : "3分钟";

    // if (isMasterQuality) {
    //   // 显示处理提示
    //   toast.info(
    //     `正在处理臻品母带2.0文件，后端需要时间添加元数据，请耐心等待...`,
    //     {
    //       duration: 10000,
    //     }
    //   );
    // }

    // 创建超时控制器
    let timeoutId: NodeJS.Timeout | null = null;

    const setupTimeout = () => {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, downloadTimeout);
    };

    const clearTimeoutIfExists = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    let fetchResponse: Response;
    try {
      // 启动超时定时器
      setupTimeout();

      console.log(`[下载] 发送请求到: ${finalUrl}`);

      fetchResponse = await fetch(finalUrl, {
        signal: abortController.signal,
        headers,
      });

      // 请求成功，清除超时定时器
      clearTimeoutIfExists();

      console.log(
        `[断点续传] 响应状态: ${fetchResponse.status} ${fetchResponse.statusText}`
      );
      console.log(
        `[断点续传] 响应头 Accept-Ranges: ${fetchResponse.headers.get(
          "accept-ranges"
        )}`
      );
      console.log(
        `[断点续传] 响应头 Content-Length: ${fetchResponse.headers.get(
          "content-length"
        )}`
      );
      console.log(
        `[断点续传] 响应头 Content-Range: ${fetchResponse.headers.get(
          "content-range"
        )}`
      );
    } catch (error) {
      // 清除超时定时器
      clearTimeoutIfExists();

      // 检查是否是超时错误
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`下载超时: ${task.songName} (${timeoutLabel})`);
      }

      throw error;
    }

    if (!fetchResponse.ok) {
      throw new Error(
        `下载失败: ${fetchResponse.status} ${fetchResponse.statusText}`
      );
    }

    // 获取文件大小信息
    const contentLength = fetchResponse.headers.get("content-length");
    const responseSize = contentLength ? parseInt(contentLength) : 0;
    const originalSize = songUrl.size || 0;

    // 处理下载流
    const reader = fetchResponse.body?.getReader();
    if (!reader) {
      throw new Error("无法获取响应流");
    }

    // 将流式读取器添加到活跃读取器中，支持暂停功能
    useDownloadStore.setState((state) => ({
      activeStreamReaders: {
        ...state.activeStreamReaders,
        [task.id]: reader,
      },
    }));

    try {
      // 使用最准确的文件大小：优先使用content-length，然后是songUrl.size
      let totalBytes =
        responseSize > 0 ? responseSize : originalSize > 0 ? originalSize : 0;

      // 如果是断点续传且响应状态是206，需要计算完整文件大小
      if (fetchResponse.status === 206 && startByte > 0) {
        const contentRange = fetchResponse.headers.get("content-range");
        if (contentRange) {
          // Content-Range: bytes 1024-2047/4096
          const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
          if (match) {
            totalBytes = parseInt(match[1]);
            console.log(
              `[断点续传] 从Content-Range获取完整文件大小: ${totalBytes}`
            );
          }
        } else {
          // 如果没有Content-Range头，计算完整文件大小
          totalBytes = startByte + responseSize;
          console.log(
            `[断点续传] 计算完整文件大小: ${startByte} + ${responseSize} = ${totalBytes}`
          );
        }
      } else if (fetchResponse.status === 200 && startByte > 0) {
        // 后端不支持断点续传，需要重新开始下载
        console.warn(
          `[断点续传] 后端不支持断点续传 (响应200而非206)，重新开始下载`
        );
        // 清除已有的临时数据，从头开始
        useDownloadStore.setState((state) => ({
          tempDownloadData: {
            ...state.tempDownloadData,
            [task.id]: undefined,
          },
        }));
        // 重置起始字节
        startByte = 0;
      }

      // 处理流式下载
      let receivedBytes = startByte; // 从断点续传位置开始
      const chunks: Uint8Array[] = [];
      let lastProgressUpdate = 0;

      console.log(
        `[断点续传] 开始接收数据: startByte=${startByte}, totalBytes=${totalBytes}`
      );

      // 设置初始进度
      const initialProgress =
        totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;
      useDownloadStore
        .getState()
        .updateTaskProgress(
          task.id,
          initialProgress,
          receivedBytes,
          totalBytes
        );

      while (true) {
        // 检查任务状态，如果被暂停则停止下载
        const currentState = useDownloadStore.getState();
        const currentTask = currentState.tasks.find((t) => t.id === task.id);
        if (currentTask?.status === "paused") {
          console.log(`[下载] 任务已被暂停，停止下载: ${task.songName}`);
          return; // 优雅退出
        }

        const { value, done } = await reader.read();
        if (done) {
          console.log(`[断点续传] 下载完成: 总接收字节 ${receivedBytes}`);
          break;
        }

        chunks.push(value);
        receivedBytes += value.length;

        // 更新临时存储以支持速度计算
        useDownloadStore.setState((state) => ({
          tempDownloadData: {
            ...state.tempDownloadData,
            [task.id]: { chunks: [...chunks], receivedBytes },
          },
        }));

        // 计算并更新进度
        const progress =
          totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;

        // 减少进度更新频率，避免性能问题 - 只在进度变化超过1%或每10MB时更新
        const progressChanged = Math.abs(progress - lastProgressUpdate) >= 1;
        const sizeThreshold = receivedBytes % (10 * 1024 * 1024) === 0;

        if (progressChanged || sizeThreshold || progress === 100) {
          useDownloadStore
            .getState()
            .updateTaskProgress(task.id, progress, receivedBytes, totalBytes);
          lastProgressUpdate = progress;
        }
      }

      // 合并数据块
      const mergedData = new Uint8Array(receivedBytes);
      let offset = 0;
      chunks.forEach((chunk) => {
        mergedData.set(chunk, offset);
        offset += chunk.length;
      });

      // 确定文件类型和扩展名
      // 1. 根据Content-Type头
      const contentType = fetchResponse.headers.get("Content-Type");
      let fileExtension = "mp3"; // 默认使用mp3
      let mimeType = "audio/mpeg";

      console.log(`[文件类型] Content-Type: ${contentType}`);
      console.log(`[文件类型] 请求的音质: ${task.quality}`);

      // 2. 先根据音质判断后缀
      if (
        task.quality === "MASTER" ||
        task.quality === "ATMOS_2" ||
        task.quality === "ATMOS_51" ||
        task.quality === "flac"
      ) {
        fileExtension = "flac";
        mimeType = "audio/flac";
      } else if (task.quality === "320" || task.quality === "128") {
        fileExtension = "mp3";
        mimeType = "audio/mpeg";
      }

      // 3. 再根据Content-Type和URL判断
      if (contentType) {
        if (contentType.includes("flac")) {
          fileExtension = "flac";
          mimeType = "audio/flac";
        } else if (contentType.includes("mp4") || contentType.includes("m4a")) {
          fileExtension = "m4a";
          mimeType = "audio/mp4";
        } else if (
          contentType.includes("mp3") ||
          contentType.includes("mpeg")
        ) {
          fileExtension = "mp3";
          mimeType = "audio/mpeg";
        }
      }

      // 4. 分析文件头部特征识别(如果是redirect=true时可能无法正确获取Content-Type)
      if (mergedData.length > 4) {
        // FLAC文件头: "fLaC"
        if (
          mergedData[0] === 0x66 && // f
          mergedData[1] === 0x4c && // L
          mergedData[2] === 0x61 && // a
          mergedData[3] === 0x43 // C
        ) {
          fileExtension = "flac";
          mimeType = "audio/flac";
          console.log("[文件类型] 通过文件头识别为FLAC格式");
        }
        // MP3文件头标识: "ID3" 或者 0xFF 0xFB
        else if (
          (mergedData[0] === 0x49 &&
            mergedData[1] === 0x44 &&
            mergedData[2] === 0x33) || // ID3
          (mergedData[0] === 0xff &&
            (mergedData[1] === 0xfb || mergedData[1] === 0xfa)) // MP3帧头
        ) {
          fileExtension = "mp3";
          mimeType = "audio/mpeg";
          console.log("[文件类型] 通过文件头识别为MP3格式");
        }
      }

      console.log(
        `[文件类型] 最终确定类型: ${mimeType}, 扩展名: ${fileExtension}`
      );

      // 生成文件名
      let fileName = `${task.artist} - ${task.songName}.${fileExtension}`;

      // 检查是否有服务器推荐的文件名
      const contentDisposition = fetchResponse.headers.get(
        "Content-Disposition"
      );
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          try {
            // 使用服务器建议的文件名，但保留我们确定的扩展名
            const serverFilename = decodeURIComponent(filenameMatch[1]);
            // 替换服务器文件名的扩展名
            fileName = serverFilename.replace(/\.[^/.]+$/, `.${fileExtension}`);
            console.log(`[文件类型] 使用服务器文件名并替换扩展名: ${fileName}`);
          } catch {
            // 解码失败，使用默认文件名
            console.log(`[文件类型] 解码失败，使用默认文件名: ${fileName}`);
          }
        }
      }

      // 保存文件
      const blob = new Blob([mergedData], { type: mimeType });
      const saveSuccess = await saveBlob(blob, fileName);
      if (!saveSuccess) {
        throw new Error("文件保存失败");
      }

      // 更新任务状态为完成，使用统一的状态管理
      useDownloadStore.getState().updateTaskStatus(task.id, "completed");

      // 清除临时下载数据，因为任务已完成
      useDownloadStore.setState((state) => ({
        tempDownloadData: {
          ...state.tempDownloadData,
          [task.id]: undefined,
        },
      }));

      // 立即返回，防止函数继续执行
      return;
    } finally {
      // 清除超时定时器
      clearTimeoutIfExists();

      // 从活跃读取器中移除（无论成功还是失败）
      useDownloadStore.setState((state) => {
        const newActiveStreamReaders = { ...state.activeStreamReaders };
        delete newActiveStreamReaders[task.id];
        // 注意：不在这里清除tempDownloadData，让暂停时保留数据
        return {
          activeStreamReaders: newActiveStreamReaders,
        };
      });
    }
  } catch (error) {
    // 清理相关状态
    useDownloadStore.setState((state) => {
      const newActiveDownloads = { ...state.activeDownloads };
      delete newActiveDownloads[task.id];
      const newActiveStreamReaders = { ...state.activeStreamReaders };
      delete newActiveStreamReaders[task.id];

      return {
        activeDownloads: newActiveDownloads,
        activeStreamReaders: newActiveStreamReaders,
        // 注意：不在这里清除tempDownloadData，让暂停时保留数据
      };
    });

    // 检查任务状态，如果是用户操作导致的中止，不抛出错误
    const currentState = useDownloadStore.getState();
    const currentTask = currentState.tasks.find((t) => t.id === task.id);

    // ✅ 增强网络中断错误识别和处理
    const isNetworkInterruption =
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.name === "TypeError" ||
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("network") ||
        error.message?.includes("Connection") ||
        error.message?.includes("The user aborted a request"));

    // 如果是网络中断（包括页面刷新），优雅处理，不抛出错误
    if (isNetworkInterruption) {
      console.log(
        `[下载管理器] 网络中断处理: ${task.songName}, 错误类型: ${error.name}, 消息: ${error.message}`
      );

      // 如果任务还是downloading状态，标记为暂停
      if (currentTask?.status === "downloading") {
        useDownloadStore.getState().updateTaskStatus(task.id, "paused");
      }

      return; // 不抛出错误，优雅退出
    }

    // 只有在真正的错误时才清除tempDownloadData
    useDownloadStore.setState((state) => ({
      tempDownloadData: {
        ...state.tempDownloadData,
        [task.id]: undefined,
      },
    }));

    throw error;
  }
}

// 添加全局错误处理器来捕获AbortError
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    // 静默处理AbortError
    if (event.reason?.name === "AbortError") {
      event.preventDefault();
    }
  });
}
