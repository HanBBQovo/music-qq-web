/**
 * 音频URL获取工具
 * 对接真实的QQ音乐流式播放API
 */

import type { Song } from "../types/music";
import type { AudioQuality } from "../api/types";
import { HTTP_HEADERS, USER_AGENTS } from "@/lib/constants/http-headers";
import { toast } from "sonner";

// 使用现有的API客户端和配置，确保与其他API保持一致
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * 构建正确的API路径
 * @param endpoint API端点
 * @returns 完整的API URL
 */
function buildApiUrl(endpoint: string): string {
  // 如果BASE_URL是相对路径（如/music-api），需要特殊处理
  if (API_BASE_URL === "/music-api") {
    if (typeof window !== "undefined") {
      // 客户端环境，使用完整URL
      return `${window.location.origin}/music-api${endpoint}`;
    } else {
      // 服务器端渲染环境
      return `/music-api${endpoint}`;
    }
  }
  // 处理标准开发环境（完整URL）
  else if (
    API_BASE_URL &&
    (API_BASE_URL.includes("://") || API_BASE_URL.startsWith("http"))
  ) {
    // BASE_URL是完整URL
    return `${API_BASE_URL}${endpoint}`;
  }
  // 处理其他情况
  else {
    if (typeof window !== "undefined") {
      // 客户端环境，使用当前域名
      return `${window.location.origin}${endpoint}`;
    } else {
      // 服务器端渲染环境
      return endpoint;
    }
  }
}

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
    const streamUrl = buildApiUrl(
      `/api/play/stream?mid=${encodeURIComponent(
        mid
      )}&quality=${quality}&autoFallback=true&redirect=true`
    );

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

      // 如果发生了音质降级，发送事件通知播放器
      if (qualityFallback === "true" && actualQuality && requestedQuality) {
        console.warn(`⚠️ 音质自动降级: ${requestedQuality} → ${actualQuality}`);
        console.warn(`降级原因: ${fallbackReason || "请求的音质不可用"}`);

        // 处理降级原因，避免显示编码内容
        const cleanReason = cleanFallbackReason(fallbackReason);

        // 更新播放器的当前音质状态（不在这里显示toast，由usePlayerStore统一处理）
        if (typeof window !== "undefined") {
          // 发送自定义事件通知播放器更新音质状态
          window.dispatchEvent(
            new CustomEvent("quality-fallback", {
              detail: {
                songId: mid,
                requestedQuality,
                actualQuality,
                fallbackReason: cleanReason, // 使用清理后的原因
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
      console.warn(
        `⚠️ 音频流不可用: HTTP ${response.status}, 尝试获取错误详情`
      );

      // 提取响应头中的错误信息
      const errorCode = response.headers.get("x-error-code");
      const errorMessage = response.headers.get("x-error-message");
      const errorDetail = response.headers.get("x-error-detail");

      let friendlyMessage = `音频流不可用: HTTP ${response.status}`;

      // 如果有中文错误信息，尝试解码
      if (errorMessage) {
        try {
          // 解码base64编码的中文消息
          const decodedMessage = decodeURIComponent(escape(atob(errorMessage)));
          friendlyMessage = decodedMessage;
        } catch (e) {
          console.warn("解码错误消息失败:", e);
          friendlyMessage = errorMessage;
        }
      }

      console.warn(`❌ 错误详情: 代码=${errorCode}, 消息=${friendlyMessage}`);
      throw new Error(friendlyMessage);
    }
  } catch (error) {
    console.error(`❌ 获取《${song.title}》音频流失败:`, error);

    // 显示播放失败的错误提示
    toast.error(`播放失败: ${song.title}`, {
      description: error instanceof Error ? error.message : "音频源不可用",
      duration: 5000,
    });

    // 重新抛出错误，不使用测试音频备用方案
    throw error;
  }
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
      buildApiUrl(`/api/play/info?mid=${encodeURIComponent(mid)}`),
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
    const response = await fetch(buildApiUrl("/api/play/stats"), {
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
      url: buildApiUrl("/api/play/stats"),
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
    const endpoint = mid
      ? `/api/play/stats/${encodeURIComponent(mid)}`
      : `/api/play/stats`;

    const url = buildApiUrl(endpoint);

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

/**
 * 清理降级原因，避免显示编码内容
 * @param reason 原始降级原因
 * @returns 清理后的降级原因
 */
function cleanFallbackReason(reason: string | null): string {
  if (!reason) return "请求的音质不可用";

  // 检查是否是base64编码（简单检测）
  if (reason.length > 50 && /^[A-Za-z0-9+/]+=*$/.test(reason)) {
    try {
      // 尝试解码base64
      const decoded = atob(reason);

      // 尝试处理UTF-8编码的中文内容
      try {
        // 将解码的字节序列转换为正确的UTF-8字符串
        const utf8Decoded = decodeURIComponent(escape(decoded));
        if (utf8Decoded && utf8Decoded.length > 0 && utf8Decoded !== decoded) {
          reason = utf8Decoded;
        } else {
          // 如果UTF-8解码没有改变内容，检查是否是可读的ASCII
          if (decoded && /^[\x20-\x7E\s]*$/.test(decoded)) {
            reason = decoded;
          } else {
            // 无法解码，使用默认消息
            return "音质资源不可用，已自动降级";
          }
        }
      } catch (utf8Error) {
        // UTF-8解码失败，尝试直接使用base64解码结果
        if (decoded && /^[\x20-\x7E\s]*$/.test(decoded)) {
          reason = decoded;
        } else {
          return "音质资源不可用，已自动降级";
        }
      }
    } catch (e) {
      // 解码失败，使用默认消息
      return "音质资源不可用，已自动降级";
    }
  }

  // 清理HTML实体和特殊字符
  let cleaned = reason
    .replace(/&#\d+;/g, "") // 移除数字HTML实体
    .replace(/&[^;]+;/g, "") // 移除其他HTML实体
    .replace(/<[^>]*>/g, "") // 移除HTML标签
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // 移除控制字符
    .trim();

  // 如果清理后太长，截断并添加省略号
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 97) + "...";
  }

  // 如果清理后为空或太短，使用默认消息
  if (!cleaned || cleaned.length < 3) {
    return "音质资源不可用，已自动降级";
  }

  return cleaned;
}
