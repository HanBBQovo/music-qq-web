import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并CSS类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 将秒数格式化为 mm:ss 格式
 * @param seconds 秒数
 * @returns 格式化后的时间字符串
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * 格式化文件大小
 * @param bytes 字节大小
 * @returns 格式化后的大小字符串
 */
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

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * 从音乐平台专辑MID获取专辑封面URL
 * @param albumMid 专辑MID
 * @param size 封面尺寸 (默认150)
 * @returns 封面URL
 */
export function getCoverUrl(albumMid: string, size: number = 150): string {
  if (!albumMid) {
    return "";
  }

  // 音乐平台官方封面格式
  // 1. 旧格式: https://y.gtimg.cn/music/photo_new/T002R300x300M000{albumMid}.jpg
  // 2. 新格式: https://y.qq.com/music/photo_new/T002R300x300M000{albumMid}.jpg

  // 获取albumMid的最后两位数字，用于第三种URL格式
  const lastTwoDigits = parseInt(albumMid.slice(-2)) || 0;

  // 2023-2024年更新的格式
  const urls = [
    // 格式1: 音乐平台当前主要使用的格式
    `https://y.qq.com/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg`,
    // 格式2: 较早使用但仍然有效的CDN格式
    `https://y.gtimg.cn/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg`,
    // 格式3: 备用CDN格式
    `https://imgcache.qq.com/music/photo/album_${size}/${lastTwoDigits}/${size}_albumpic_${albumMid}_0.jpg`,
    // 格式4: 另一种常见格式
    `https://y.qq.com/n/yqq/album/${albumMid}.html`,
  ];

  return urls[0];
}

/**
 * 从歌手MID获取歌手头像URL
 * @param singerMid 歌手MID
 * @param size 图片尺寸，默认300
 * @returns 歌手头像URL
 */
export function getSingerAvatarUrl(
  singerMid: string,
  size: number = 300
): string {
  if (!singerMid) return "";
  return `https://y.qq.com/music/photo_new/T001R${size}x${size}M000${singerMid}.jpg`;
}

/**
 * 格式化发布时间
 * @param timestamp 时间戳或日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatReleaseDate(timestamp: string | number): string {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 过滤歌曲名称中的特殊标记
 * @param songName 歌曲名称
 * @returns 过滤后的歌曲名称
 */
export function cleanSongName(songName: string): string {
  if (!songName) return "";

  // 去除类似 (Live)、[DJ版]、【电视剧版】等标记
  return songName
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/【.*?】/g, "")
    .replace(/（.*?）/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 延迟函数
 * @param ms 毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 节流函数
 * @param fn 要执行的函数
 * @param limit 时间限制（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= limit) {
      fn(...args);
      lastCall = now;
    }
  };
}

/**
 * 从URL提取歌曲ID
 */
export function extractSongIdFromUrl(url: string): string | null {
  // 支持多种格式：
  // - https://y.qq.com/n/ryqq/songDetail/001Qu4I30eVFYb
  // - https://y.qq.com/n/yqq/song/001Qu4I30eVFYb.html

  const regex = /(?:songDetail|song)\/([a-zA-Z0-9]+)/;
  const match = url.match(regex);

  return match ? match[1] : null;
}

/**
 * 从URL提取歌单ID
 */
export function extractPlaylistIdFromUrl(url: string): string | null {
  // 支持格式：
  // - https://y.qq.com/n/ryqq/playlist/8326909915

  const regex = /playlist\/(\d+)/;
  const match = url.match(regex);

  return match ? match[1] : null;
}

/**
 * 从URL提取专辑ID
 */
export function extractAlbumIdFromUrl(url: string): string | null {
  // 支持格式：
  // - https://y.qq.com/n/ryqq/albumDetail/003rytri2FHG3V

  const regex = /albumDetail\/([a-zA-Z0-9]+)/;
  const match = url.match(regex);

  return match ? match[1] : null;
}

/**
 * 智能识别音乐链接类型和ID
 * @param url 音乐链接
 * @returns 解析结果
 */
export function parseMusicLink(url: string): {
  success: boolean;
  type?: "song" | "album" | "playlist";
  id?: string;
  mid?: string;
  needServerParsing?: boolean;
} {
  if (!url || typeof url !== "string") {
    return { success: false };
  }

  const normalizedUrl = url.trim();

  // 歌曲链接
  const songMid = extractSongIdFromUrl(normalizedUrl);
  if (songMid) {
    return {
      success: true,
      type: "song",
      mid: songMid,
    };
  }

  // 专辑链接
  const albumMid = extractAlbumIdFromUrl(normalizedUrl);
  if (albumMid) {
    return {
      success: true,
      type: "album",
      mid: albumMid,
    };
  }

  // 歌单链接
  const playlistId = extractPlaylistIdFromUrl(normalizedUrl);
  if (playlistId) {
    return {
      success: true,
      type: "playlist",
      id: playlistId,
    };
  }

  // 检查是否是需要服务器解析的复杂格式
  if (
    normalizedUrl.includes("c6.y.qq.com") ||
    normalizedUrl.includes("i.y.qq.com") ||
    normalizedUrl.includes("y.qq.com/w/") ||
    normalizedUrl.includes("y.qq.com/m/")
  ) {
    return {
      success: false,
      needServerParsing: true,
    };
  }

  return { success: false };
}

/**
 * 调用后端API解析链接
 * @param url 需要解析的链接
 * @returns 解析结果Promise
 */
export async function parseMusicLinkServer(url: string): Promise<{
  success: boolean;
  type?: "song" | "album" | "playlist";
  id?: string;
  mid?: string;
  error?: string;
  playlistData?: {
    name: string;
    songs: string[];
    songCount: number;
  };
}> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/parse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.code === 0) {
      return {
        success: true,
        ...result.data,
      };
    } else {
      return {
        success: false,
        error: result.message || "解析失败",
      };
    }
  } catch (error: any) {
    console.error("服务器链接解析错误:", error);
    return {
      success: false,
      error: error.message || "网络请求失败",
    };
  }
}

/**
 * 根据解析结果生成跳转URL
 * @param parseResult 解析结果
 * @returns 跳转URL或null
 */
export function generateRedirectUrl(parseResult: {
  type?: "song" | "album" | "playlist";
  id?: string;
  mid?: string;
}): string | null {
  if (!parseResult.type) {
    return null;
  }

  switch (parseResult.type) {
    case "song":
      if (parseResult.mid) {
        return `/song/${parseResult.mid}`;
      }
      break;
    case "album":
      if (parseResult.mid) {
        return `/album/${parseResult.mid}`;
      }
      break;
    case "playlist":
      if (parseResult.id) {
        return `/playlist/${parseResult.id}`;
      }
      break;
  }

  return null;
}

/**
 * 保存Blob文件到用户设备
 * @param blob 文件blob对象
 * @param fileName 文件名
 * @returns 保存是否成功的Promise
 */
export async function saveBlob(blob: Blob, fileName: string): Promise<boolean> {
  try {
    // 获取用户的下载行为设置
    const settingsStore = localStorage.getItem("settings-store");
    let downloadBehavior = "auto"; // 默认为自动下载

    if (settingsStore) {
      try {
        const settings = JSON.parse(settingsStore);
        downloadBehavior = settings.state?.downloadBehavior || "auto";
      } catch (error) {
        console.warn("解析设置失败，使用默认下载行为:", error);
      }
    }

    // 根据用户设置选择下载方式
    if (downloadBehavior === "ask") {
      // 每次询问保存位置 - 使用文件系统访问API
      if ("showSaveFilePicker" in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: "音频文件",
                accept: {
                  "audio/*": [".mp3", ".flac", ".m4a"],
                },
              },
            ],
          });

          const writableStream = await fileHandle.createWritable();
          await writableStream.write(blob);
          await writableStream.close();

          return true;
        } catch (error: any) {
          // 用户取消选择时返回false
          if (error.name === "AbortError") {
            console.log("用户取消了文件保存");
            return false;
          }
          console.error("文件系统API保存失败，回退到传统下载方式:", error);
          // 继续执行传统下载方式
        }
      }
    }

    // 自动下载到默认文件夹 - 使用传统下载方法
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    return true;
  } catch (error: any) {
    console.error("保存文件失败:", error);
    return false;
  }
}
