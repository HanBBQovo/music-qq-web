/**
 * 音频URL获取工具
 * 对接真实的QQ音乐流式播放API
 */

import type { Song } from "../types/music";
import type { AudioQuality } from "../api/types";
import { HTTP_HEADERS, USER_AGENTS } from "@/lib/constants/http-headers";
import { toast } from "sonner";

// 使用现有的API客户端和配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * 获取QQ音乐Cookie
 */
export function getQQCookie(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("qqmusic_cookie") || "";
  }
  return "";
}

/**
 * 获取歌曲的音频流URL
 * @param song 歌曲信息
 * @param quality 音质偏好（默认320）
 * @returns Promise<string> 音频流URL
 */
export async function getAudioUrl(
  song: Song,
  quality: AudioQuality = "320"
): Promise<string> {
  // 如果歌曲已经有URL，直接返回
  if (song.url) {
    return song.url;
  }

  try {
    // 获取歌曲的MID，优先使用mid字段，确保是QQ音乐MID格式
    let mid = song.mid || song.id || "";
    if (!mid) {
      throw new Error("歌曲MID不能为空");
    }

    // 验证MID格式：QQ音乐MID通常是字母数字组合，如 '003a2DsM1zYZd3'
    // 如果是纯数字，可能不是正确的QQ音乐MID
    if (/^\d+$/.test(mid)) {
      console.warn(
        `⚠️ 检测到疑似数字ID而非QQ音乐MID: ${mid}，歌曲：${song.title}`
      );
      // 如果song.mid存在且不是纯数字，优先使用
      if (song.mid && !/^\d+$/.test(song.mid)) {
        mid = song.mid;
        console.log(`✅ 使用正确的MID字段: ${mid}`);
      } else if (song.id && !/^\d+$/.test(song.id)) {
        mid = song.id;
        console.log(`✅ 使用ID字段作为MID: ${mid}`);
      } else {
        console.error(`❌ 无法找到有效的QQ音乐MID，歌曲：${song.title}`);
        throw new Error(`无效的QQ音乐MID格式: ${mid}`);
      }
    }

    // 获取QQ音乐Cookie
    const cookie = getQQCookie();
    if (!cookie) {
      console.warn("⚠️ 未配置QQ音乐Cookie，可能无法正常播放");
    }

    // 构建流式播放API URL
    const streamUrl = `${API_BASE_URL}/api/play/stream?mid=${encodeURIComponent(
      mid
    )}&quality=${quality}&autoFallback=true`;

    console.log(`🎵 正在获取《${song.title}》的音频流:`, {
      mid,
      originalSongId: song.id,
      originalSongMid: song.mid,
      quality,
      hasCookie: !!cookie,
      url: streamUrl,
    });

    // 验证流式播放URL是否可访问
    const response = await fetch(streamUrl, {
      method: "HEAD",
      headers: {
        [HTTP_HEADERS.QQ_COOKIE]: cookie,
        Range: "bytes=0-1023",
        "User-Agent": USER_AGENTS.DESKTOP,
      },
    });

    if (response.ok) {
      console.log(`✅ 成功获取《${song.title}》的音频流URL`);

      // 调试：打印所有响应头
      console.log("🔍 所有响应头:", Array.from(response.headers.entries()));

      // 解析音质信息
      const qualityInfo = parseQualityInfo(response);
      console.log("🎵 解析的音质信息:", qualityInfo);

      // 检测音质降级响应头
      const actualQuality = response.headers.get("X-Quality");
      const requestedQuality = response.headers.get("X-Requested-Quality");
      const qualityFallback = response.headers.get("X-Quality-Fallback");
      const fallbackReason = response.headers.get("X-Fallback-Reason");

      // 如果发生了音质降级，提示用户并更新音质设置
      if (qualityFallback === "true" && actualQuality && requestedQuality) {
        console.warn(`⚠️ 音质自动降级: ${requestedQuality} → ${actualQuality}`);
        console.warn(`降级原因: ${fallbackReason || "请求的音质不可用"}`);

        // 显示降级提示
        toast.warning(
          `音质已自动降级：${getQualityDisplayName(
            requestedQuality
          )} → ${getQualityDisplayName(actualQuality)}`,
          {
            description: fallbackReason || "请求的音质不可用，已自动降级",
            duration: 5000,
          }
        );

        // 更新播放器的当前音质状态
        if (typeof window !== "undefined") {
          // 发送自定义事件通知播放器更新音质状态
          window.dispatchEvent(
            new CustomEvent("quality-fallback", {
              detail: {
                songId: mid,
                requestedQuality,
                actualQuality,
                fallbackReason,
              },
            })
          );
        }
      }

      // 发送音质信息更新事件
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("quality-info-updated", {
            detail: {
              songId: mid,
              qualityInfo,
            },
          })
        );
      }

      return streamUrl;
    } else {
      console.warn(`⚠️ 音频流不可用: HTTP ${response.status}, 尝试测试音频`);
      throw new Error(`音频流不可用: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ 获取《${song.title}》音频流失败:`, error);

    // 如果后端API不可用，使用备用方案（测试音频）
    console.log("🔄 使用测试音频作为备用方案");
    return getTestAudioUrl();
  }
}

/**
 * 获取测试音频URL（后端不可用时的备用方案）
 */
function getTestAudioUrl(): string {
  const testAudioUrls = [
    "https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3",
    "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
    "https://file-examples.com/storage/fe7a6b657faa64b9d7a9d56/2017/11/file_example_MP3_700KB.mp3",
  ];

  return testAudioUrls[Math.floor(Math.random() * testAudioUrls.length)];
}

/**
 * 获取歌曲播放信息（不记录播放统计）
 * @param song 歌曲信息
 * @returns Promise<any> 播放信息
 */
export async function getPlayInfo(song: Song): Promise<any> {
  try {
    // 使用相同的MID验证逻辑
    let mid = song.mid || song.id || "";
    if (!mid) {
      throw new Error("歌曲MID不能为空");
    }

    // 验证MID格式
    if (/^\d+$/.test(mid)) {
      console.warn(
        `⚠️ getPlayInfo 检测到疑似数字ID: ${mid}，歌曲：${song.title}`
      );
      if (song.mid && !/^\d+$/.test(song.mid)) {
        mid = song.mid;
      } else if (song.id && !/^\d+$/.test(song.id)) {
        mid = song.id;
      } else {
        throw new Error(`无效的QQ音乐MID格式: ${mid}`);
      }
    }

    const cookie = getQQCookie();
    const response = await fetch(
      `${API_BASE_URL}/api/play/info?mid=${encodeURIComponent(mid)}`,
      {
        method: "GET",
        headers: {
          [HTTP_HEADERS.QQ_COOKIE]: cookie,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const result = await response.json();

    if (result.code === 0) {
      return result.data;
    } else {
      throw new Error(result.message || "获取播放信息失败");
    }
  } catch (error) {
    console.error("获取播放信息失败:", error);
    return null;
  }
}

/**
 * 根据不同音质获取音频流URL
 * @param song 歌曲信息
 * @param quality 音质选择 (320, 128, flac等)
 * @returns Promise<string> 音频流URL
 */
export async function getAudioUrlWithQuality(
  song: Song,
  quality: AudioQuality = "320"
): Promise<string> {
  return getAudioUrl(song, quality);
}

/**
 * 批量获取多首歌曲的音频URL
 * @param songs 歌曲列表
 * @returns Promise<Song[]> 包含URL的歌曲列表
 */
export async function getAudioUrlsBatch(songs: Song[]): Promise<Song[]> {
  const results = await Promise.allSettled(
    songs.map(async (song) => {
      try {
        const url = await getAudioUrl(song);
        return { ...song, url };
      } catch (error) {
        console.error(`获取《${song.title}》音频URL失败:`, error);
        return { ...song, url: undefined, error: (error as Error).message };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        ...songs[index],
        url: undefined,
        error: result.reason?.message || "获取音频URL失败",
      };
    }
  });
}

/**
 * 预加载音频URL（用于播放列表预加载）
 * @param song 歌曲信息
 * @returns Promise<string | null> 音频URL或null（如果失败）
 */
export async function preloadAudioUrl(song: Song): Promise<string | null> {
  try {
    return await getAudioUrl(song);
  } catch (error) {
    console.warn(`预加载《${song.title}》音频URL失败:`, error);
    return null;
  }
}

/**
 * 清理过期的音频URL缓存
 * 注意：这是一个模拟实现，实际项目中可能需要更复杂的缓存管理
 */
export function clearAudioUrlCache(): void {
  console.log("[模拟] 清理音频URL缓存");
  // 实际实现中可能需要清理内存中的URL缓存
}

/**
 * 检查后端API服务状态
 * @returns Promise<boolean> 服务是否可用
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const cookie = getQQCookie();
    const response = await fetch(`${API_BASE_URL}/api/play/stats`, {
      method: "GET",
      headers: {
        [HTTP_HEADERS.QQ_COOKIE]: cookie,
        "Content-Type": "application/json",
      },
    });
    console.log("🔍 API健康检查:", {
      status: response.status,
      ok: response.ok,
      hasCookie: !!cookie,
      url: `${API_BASE_URL}/api/play/stats`,
    });
    return response.ok;
  } catch (error) {
    console.warn("⚠️ 后端API服务不可用:", error);
    return false;
  }
}

/**
 * 验证音频URL是否有效
 * @param url 音频URL
 * @returns Promise<boolean> 是否有效
 */
export async function validateAudioUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error("验证音频URL失败:", error);
    return false;
  }
}

/**
 * 获取播放统计信息
 * @param mid 歌曲MID（可选，不传则获取所有统计）
 * @returns Promise<any> 播放统计数据
 */
export async function getPlayStats(mid?: string): Promise<any> {
  try {
    const url = mid
      ? `${API_BASE_URL}/api/play/stats/${encodeURIComponent(mid)}`
      : `${API_BASE_URL}/api/play/stats`;

    const cookie = getQQCookie();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        [HTTP_HEADERS.QQ_COOKIE]: cookie,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const result = await response.json();

    if (result.code === 0) {
      return result.data;
    } else {
      throw new Error(result.message || "获取播放统计失败");
    }
  } catch (error) {
    console.error("获取播放统计失败:", error);
    return null;
  }
}

/**
 * 获取支持的音质列表
 * @returns Promise<Array> 音质选项
 */
export async function getSupportedQualities(): Promise<
  Array<{ key: string; label: string }>
> {
  // 根据QQ音乐API支持的音质返回选项
  return getDefaultQualities();
}

/**
 * 默认音质选项
 */
function getDefaultQualities() {
  return [
    { key: "128", label: "MP3 128K" },
    { key: "320", label: "MP3 320K" },
    { key: "flac", label: "FLAC 无损" },
    { key: "ape", label: "APE 无损" },
  ];
}

/**
 * 设置QQ音乐Cookie
 * @param cookie QQ音乐Cookie
 */
export function setQQCookie(cookie: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("qqmusic_cookie", cookie);
  }
}

/**
 * 获取音质显示名称
 * @param quality 音质代码
 * @returns 显示名称
 */
function getQualityDisplayName(quality: string): string {
  switch (quality) {
    case "128":
      return "标准音质";
    case "320":
      return "高品音质";
    case "flac":
      return "无损音质";
    case "ATMOS_2":
      return "臻品全景声2.0";
    case "ATMOS_51":
      return "臻品音质2.0";
    case "MASTER":
      return "臻品母带2.0";
    default:
      return quality;
  }
}

/**
 * 音质信息接口
 */
export interface QualityInfo {
  availableQualities: AudioQuality[];
  qualitySizes: Record<string, number>;
  recommendedQuality: AudioQuality | null;
  qualityDetails: Record<
    string,
    {
      size: number;
      format: string;
      isVip: boolean;
      description: string;
    }
  >;
}

/**
 * 解析响应头中的音质信息
 * @param response fetch响应对象
 * @returns 音质信息
 */
export function parseQualityInfo(response: Response): QualityInfo {
  const defaultInfo: QualityInfo = {
    availableQualities: [],
    qualitySizes: {},
    recommendedQuality: null,
    qualityDetails: {},
  };

  try {
    // 解析可用音质列表
    const availableQualitiesHeader = response.headers.get(
      "X-Available-Qualities"
    );
    let availableQualities: AudioQuality[] = [];
    if (availableQualitiesHeader) {
      availableQualities = availableQualitiesHeader
        .split(",")
        .map((q) => q.trim()) as AudioQuality[];
    }

    // 解析音质大小
    const qualitySizesHeader = response.headers.get("X-Quality-Sizes");
    const qualitySizes: Record<string, number> = {};
    if (qualitySizesHeader) {
      qualitySizesHeader.split(",").forEach((item) => {
        const [quality, sizeStr] = item.split(":");
        if (quality && sizeStr) {
          qualitySizes[quality.trim()] = parseInt(sizeStr.trim());
        }
      });
    }

    // 解析推荐音质
    const recommendedQuality = response.headers.get(
      "X-Recommended-Quality"
    ) as AudioQuality | null;

    // 解析音质详细信息
    const qualityDetailsHeader = response.headers.get("X-Quality-Details");
    const qualityDetails: Record<string, any> = {};
    if (qualityDetailsHeader) {
      qualityDetailsHeader.split(",").forEach((item) => {
        const parts = item.split(":");
        if (parts.length >= 5) {
          const [quality, sizeStr, format, isVipStr, description] = parts;
          qualityDetails[quality.trim()] = {
            size: parseInt(sizeStr.trim()),
            format: format.trim(),
            isVip: isVipStr.trim() === "true",
            description: description.trim(),
          };
        }
      });
    }

    // 尝试解析完整JSON信息（Base64编码）
    const qualitiesJsonHeader = response.headers.get("X-Qualities-JSON");
    if (qualitiesJsonHeader) {
      try {
        const decodedJson = atob(qualitiesJsonHeader);
        const fullQualityInfo = JSON.parse(decodedJson);

        // 如果JSON解析成功，优先使用JSON中的信息
        if (Array.isArray(fullQualityInfo)) {
          fullQualityInfo.forEach((item: any) => {
            if (item.quality && item.size !== undefined) {
              qualitySizes[item.quality] = item.size;
              qualityDetails[item.quality] = {
                size: item.size,
                format: item.format || "mp3",
                isVip: item.isVip || false,
                description: item.description || "",
              };
            }
          });
        }
      } catch (jsonError) {
        console.warn("解析X-Qualities-JSON失败:", jsonError);
      }
    }

    console.log("🔍 解析的音质信息:", {
      availableQualities,
      qualitySizes,
      recommendedQuality,
      qualityDetails,
    });

    return {
      availableQualities,
      qualitySizes,
      recommendedQuality,
      qualityDetails,
    };
  } catch (error) {
    console.error("解析音质信息失败:", error);
    return defaultInfo;
  }
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化的大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "未知";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}
