import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并CSS类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
