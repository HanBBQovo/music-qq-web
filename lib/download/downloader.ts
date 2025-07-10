import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { DownloadTask, SongUrlInfo, AudioQuality } from "../api/types";
import { DownloadState } from "../store/useDownloadStore";
import musicApi from "../api/client";
import { saveBlob } from "../utils";
import { extractApiErrorMessage } from "../utils/error";

// 下载歌曲的辅助函数
export async function downloadSong(
  task: DownloadTask,
  get: () => DownloadState,
  set: (
    partial:
      | Partial<DownloadState>
      | ((state: DownloadState) => Partial<DownloadState>)
  ) => void
): Promise<void> {
  try {
    // 创建中止控制器
    const abortController = new AbortController();

    // 将中止控制器添加到活跃下载中
    set((state: DownloadState) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [task.id]: abortController,
      },
    }));

    // 获取Cookie或Cookie池设置
    const settings = useSettingsStore.getState();
    const useCookiePool = settings.useCookiePool;
    const cookie = useCookiePool
      ? ""
      : localStorage.getItem("music_cookie") || "";
    const cookieId = useCookiePool ? settings.selectedCookieId : "";
    const enableFallback = settings.enableQualityFallback;
    const shouldAddMetadata = settings.autoAddMetadata || settings.autoAddCover;

    // 记录详细的Cookie使用日志
    console.log(`[下载管理器] Cookie使用详情:`, {
      taskId: task.id,
      songName: task.songName,
      useCookiePool: useCookiePool, // 是否使用Cookie池
      hasCookie: !!cookie, // 是否有自定义Cookie
      cookieLength: cookie?.length || 0,
      hasCookieId: !!cookieId, // 是否有Cookie ID
      cookieId: cookieId || "未选择", // Cookie ID值
      useCustomCookie: !useCookiePool && !!cookie, // 是否使用自定义Cookie
      usePoolCookie: useCookiePool && !!cookieId, // 是否使用Cookie池中的Cookie
    });

    // 获取歌曲URL
    const response = await musicApi.getSongUrl({
      mid: task.songMid,
      quality: task.quality,
      cookie: cookie,
      cookie_id: cookieId,
      enableFallback: enableFallback,
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
    set((state: DownloadState) => ({
      tasks: state.tasks.map((t: DownloadTask) =>
        t.id === task.id
          ? {
              ...t,
              actualQuality: actualQuality as AudioQuality,
              wasDowngraded: wasDowngraded,
            }
          : t
      ),
    }));

    // 验证URL格式是否有效
    const validSongUrl = songUrl.url;
    try {
      // 测试URL是否有效
      new URL(validSongUrl);
      console.log(
        `[下载] 验证歌曲URL有效: ${validSongUrl.substring(0, 50)}...`
      );
    } catch (error) {
      console.error(`[下载] 无效的URL格式: ${validSongUrl}`, error);
      throw new Error(`获取到的下载链接格式无效: ${validSongUrl}`);
    }

    // 开始下载歌曲
    const streamUrl = musicApi.getStreamUrl(
      validSongUrl,
      task.songMid,
      task.songName,
      task.artist,
      task.albumMid,
      shouldAddMetadata,
      useCookiePool ? cookieId : undefined // 仅在使用Cookie池时传递cookie_id参数
    );

    // 为URL对象添加参数
    const finalUrl = new URL(streamUrl);

    // 获取当前任务的已下载数据
    const downloadState = get();

    // ✅ 基于进度的断点续传：使用taskProgress计算已下载字节数
    const progressInfo = downloadState.taskProgress[task.id];
    let startByte = 0;

    // 修复：直接使用 task.totalBytes 来判断
    if (progressInfo && progressInfo.bytesLoaded && task.totalBytes) {
      startByte = progressInfo.bytesLoaded;
      console.log(
        `[基于进度的断点续传] 任务 ${task.songName}: 从已加载字节 ${startByte} 开始`
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

    // 设置超时处理 - 为MASTER音质设置更长超时时间
    const isMasterQuality = task.quality === "MASTER";
    const downloadTimeout = isMasterQuality ? 600000 : 180000; // MASTER: 10分钟，其他: 3分钟
    const timeoutLabel = isMasterQuality ? "10分钟" : "3分钟";

    let timeoutId: NodeJS.Timeout | null = null;
    const setupTimeout = () => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        const errorMsg = `下载超时 (${timeoutLabel})`;
        console.error(`[下载] ${errorMsg}: ${task.songName}`);
        get().updateTaskStatus(task.id, "error", errorMsg);
        get().processQueue();
      }, downloadTimeout);
    };
    const clearTimeoutIfExists = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    setupTimeout();

    // 发起下载请求
    const fetchResponse = await fetch(finalUrl.toString(), {
      signal: abortController.signal,
      headers: headers,
    });

    // 响应接收后，立即清除超时定时器
    clearTimeoutIfExists();

    if (!fetchResponse.body) {
      throw new Error("响应体为空，无法下载");
    }

    if (!fetchResponse.ok) {
      let errorMsg = `下载失败: HTTP ${fetchResponse.status}`;
      try {
        const errorData = await fetchResponse.json();
        if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (e) {
        // 忽略解析错误
      }

      // 如果是206 Partial Content，但我们是从头开始请求的，这可能是个问题
      if (fetchResponse.status === 206 && startByte === 0) {
        console.warn("[下载] 服务器返回206但并非断点续传，可能存在问题");
      }
      // 如果我们请求了Range，但服务器返回200，说明不支持断点续传
      else if (fetchResponse.status === 200 && startByte > 0) {
        console.warn(
          `[下载] 请求了Range，但服务器返回200，不支持断点续传。将从头下载: ${task.songName}`
        );
        startByte = 0; // 重置起始字节，从头开始
      }
      // 对于其他非OK状态码，直接抛出错误
      else if (fetchResponse.status !== 200 && fetchResponse.status !== 206) {
        throw new Error(errorMsg);
      }
    }

    const reader = fetchResponse.body.getReader();
    set((state: DownloadState) => ({
      activeStreamReaders: { ...state.activeStreamReaders, [task.id]: reader },
    }));

    const contentLength = fetchResponse.headers.get("Content-Length");
    // 如果服务器返回了 Content-Length，用它来更新总大小，这比HEAD请求更准
    const totalBytes = contentLength
      ? parseInt(contentLength, 10)
      : task.totalBytes || 0;

    // 如果是断点续传（206），totalBytes应该是整个文件的完整大小
    // Range响应的Content-Range头格式: `bytes start-end/total`
    const contentRange = fetchResponse.headers.get("Content-Range");
    let finalTotalBytes = totalBytes;
    if (fetchResponse.status === 206 && contentRange) {
      const match = /bytes \d+-\d+\/(\d+)/.exec(contentRange);
      if (match && match[1]) {
        finalTotalBytes = parseInt(match[1], 10);
      }
    }
    // 如果是200，Content-Length就是总大小
    else if (fetchResponse.status === 200 && contentLength) {
      finalTotalBytes = parseInt(contentLength, 10);
    }
    // 否则，使用任务中已有的totalBytes
    else {
      finalTotalBytes = task.totalBytes || 0;
    }

    if (finalTotalBytes !== task.totalBytes) {
      console.log(
        `[下载] 更新文件总大小: 从 ${task.totalBytes} 到 ${finalTotalBytes}`
      );
      get().updateTaskProgress(
        task.id,
        task.progress,
        (task.progress * finalTotalBytes) / 100,
        finalTotalBytes
      );
      set((state: DownloadState) => ({
        tasks: state.tasks.map((t: DownloadTask) =>
          t.id === task.id
            ? { ...t, totalBytes: finalTotalBytes, fileSize: finalTotalBytes }
            : t
        ),
      }));
    }

    let receivedBytes = startByte;
    const chunks: Uint8Array[] = [];

    // 开始读取数据流
    while (true) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`[下载] 流读取完成: ${task.songName}`);
          break;
        }

        chunks.push(value);
        receivedBytes += value.length;

        const progress = finalTotalBytes
          ? (receivedBytes / finalTotalBytes) * 100
          : 0;

        // 节流更新，例如每1%或每秒更新一次
        const now = Date.now();
        const lastUpdate = get().taskProgress[task.id]?.lastUpdate || 0;
        if (now - lastUpdate > 500) {
          // 每500ms更新一次
          get().updateTaskProgress(
            task.id,
            progress,
            receivedBytes,
            finalTotalBytes
          );
        }

        // 重置超时定时器
        clearTimeoutIfExists();
        setupTimeout();
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log(`[下载] 任务被中止: ${task.songName}`);
          // 保存已下载的部分
          const finalProgress =
            finalTotalBytes > 0 ? (receivedBytes / finalTotalBytes) * 100 : 0;
          get().updateTaskProgress(
            task.id,
            finalProgress,
            receivedBytes,
            finalTotalBytes
          );
        } else {
          console.error(`[下载] 读取流时出错: ${task.songName}`, error);
          throw error; // 抛出以触发外部的catch块
        }
        return; // 无论是中止还是错误，都退出循环
      }
    }

    // 下载完成，合并数据块
    const blob = new Blob(chunks);
    await saveBlob(
      blob,
      `${task.songName} - ${task.artist}.${songUrl.type || "mp3"}`
    );

    get().updateTaskStatus(task.id, "completed");
    setTimeout(() => get().processQueue(), 50);
  } catch (error: any) {
    // 确定错误原因
    let errorMsg = "下载失败";
    if (error.name === "AbortError") {
      errorMsg = "任务已中止";
      console.log(`[下载] ${errorMsg}: ${task.songName}`);
      get().updateTaskStatus(task.id, "paused", errorMsg); // 任务被用户暂停
    } else {
      errorMsg = extractApiErrorMessage(error);
      console.error(`[下载] 任务失败: ${task.songName}`, error);
      get().updateTaskStatus(task.id, "error", errorMsg); // 任务失败
    }

    // 继续处理队列中的下一个任务
    setTimeout(() => get().processQueue(), 50);
  } finally {
    // 确保从活跃下载中移除
    set((state: DownloadState) => {
      const newActiveDownloads = { ...state.activeDownloads };
      delete newActiveDownloads[task.id];
      const newStreamReaders = { ...state.activeStreamReaders };
      delete newStreamReaders[task.id];
      return {
        activeDownloads: newActiveDownloads,
        activeStreamReaders: newStreamReaders,
      };
    });
  }
}
