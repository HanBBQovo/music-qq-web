import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { AudioQuality, Song, SongUrlInfo } from "../api/types";
import musicApi from "../api/client";
import { HTTP_HEADERS } from "../constants/http-headers";

// 获取用户设置的默认音质
export function getUserDefaultQuality(): AudioQuality {
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
export async function prefetchFileSize(
  songMid: string,
  quality: AudioQuality
): Promise<number | null> {
  try {
    // 获取Cookie或Cookie池设置
    const settings = useSettingsStore.getState();
    const useCookiePool = settings.useCookiePool;
    const cookie = useCookiePool
      ? ""
      : localStorage.getItem("music_cookie") || "";
    const cookieId = useCookiePool ? settings.selectedCookieId : "";

    // 记录详细的Cookie使用日志
    console.log(`[预获取大小] Cookie使用详情:`, {
      songMid: songMid,
      quality: quality,
      useCookiePool: useCookiePool, // 是否使用Cookie池
      hasCookie: !!cookie, // 是否有自定义Cookie
      cookieLength: cookie?.length || 0,
      hasCookieId: !!cookieId, // 是否有Cookie ID
      cookieId: cookieId || "未选择", // Cookie ID值
      useCustomCookie: !useCookiePool && !!cookie, // 是否使用自定义Cookie
      usePoolCookie: useCookiePool && !!cookieId, // 是否使用Cookie池中的Cookie
    });

    // 检查用户是否启用了元数据处理
    const shouldAddMetadata = settings.autoAddMetadata || settings.autoAddCover;

    // 获取下载链接
    const response = await musicApi.getSongUrl({
      mid: songMid,
      quality: quality,
      cookie: cookie,
      cookie_id: cookieId,
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
export function formatFileSize(bytes: number): string {
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
export function getFileSizeByQuality(
  song: Song,
  quality: AudioQuality
): number {
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
export function getQualityDisplayName(quality: string): string {
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
export async function checkBackendHealth(): Promise<{
  backendLoad: number;
} | null> {
  try {
    // 获取Cookie或Cookie池设置
    const settingsStr = localStorage.getItem("settings-store");
    let useCookiePool = false;
    let selectedCookieId = "";

    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        useCookiePool = settings.state?.useCookiePool || false;
        selectedCookieId = useCookiePool
          ? settings.state?.selectedCookieId || ""
          : "";
      } catch (e) {
        console.error("[健康检查] 解析设置失败:", e);
      }
    }

    // 构建API URL
    let apiUrl = process.env.NEXT_PUBLIC_API_URL + "/api/stream/health";

    // 如果使用Cookie池且有selectedCookieId，添加到URL参数
    if (useCookiePool && selectedCookieId) {
      apiUrl += `?cookie_id=${encodeURIComponent(selectedCookieId)}`;
      console.log(`[健康检查] 使用Cookie池ID: ${selectedCookieId}`);
    }

    // 构建请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 只有在不使用Cookie池时才添加Cookie头
    if (!useCookiePool) {
      const cookie = localStorage.getItem("music_cookie");
      if (cookie) {
        headers[HTTP_HEADERS.QQ_COOKIE] = cookie;
      }
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      const healthData = await response.json();
      const loadPercentage = healthData.load?.load_percentage || 0;

      // 更新后端负载信息
      return { backendLoad: loadPercentage };
    }
    return null;
  } catch (error) {
    console.warn("[下载管理器] 后端健康检查失败:", error);
    return null;
  }
}
