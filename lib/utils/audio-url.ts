/**
 * 音频URL获取工具
 * 对接真实的音乐流式播放API
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
 * 获取音乐平台Cookie
 */
export function getQQCookie(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("music_cookie") || "";
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
    // 获取歌曲的MID，优先使用mid字段，确保是音乐MID格式
    let mid = song.mid || song.id || "";
    if (!mid) {
      throw new Error("歌曲MID不能为空");
    }

    // 验证MID格式：音乐MID通常是字母数字组合，如 '003a2DsM1zYZd3'
    // 如果是纯数字，可能不是正确的音乐MID
    if (/^\d+$/.test(mid)) {
      console.warn(
        `⚠️ 检测到疑似数字ID而非音乐MID: ${mid}，歌曲：${song.title}`
      );
      // 如果song.mid存在且不是纯数字，优先使用
      if (song.mid && !/^\d+$/.test(song.mid)) {
        mid = song.mid;
        console.log(`✅ 使用正确的MID字段: ${mid}`);
      } else if (song.id && !/^\d+$/.test(song.id)) {
        mid = song.id;
        console.log(`✅ 使用ID字段作为MID: ${mid}`);
      } else {
        console.error(`❌ 无法找到有效的音乐MID，歌曲：${song.title}`);
        throw new Error(`无效的音乐MID格式: ${mid}`);
      }
    }

    // 获取Cookie或Cookie池设置
    const settingsStr = localStorage.getItem("settings-store");
    let useCookiePool = false;
    let selectedCookieId = "";
    let cookie = "";

    if (settingsStr) {
      try {
        const parsedSettings = JSON.parse(settingsStr);
        useCookiePool = parsedSettings.state?.useCookiePool || false;
        selectedCookieId = useCookiePool
          ? parsedSettings.state?.selectedCookieId || ""
          : "";
      } catch (error) {
        console.error("解析设置失败:", error);
      }
    }

    // 只有在不使用Cookie池时才获取自定义Cookie
    if (!useCookiePool) {
      cookie = getQQCookie();
    }

    console.log("[音频URL] Cookie使用信息:", {
      useCookiePool,
      hasCookieId: !!selectedCookieId,
      cookieId: selectedCookieId || "未设置",
      hasCookie: !!cookie,
    });

    // 构建流式播放API URL
    let streamUrl = buildApiUrl(
      `/api/play/stream?mid=${encodeURIComponent(
        mid
      )}&quality=${quality}&autoFallback=true&redirect=true`
    );

    // 如果使用Cookie池，添加cookie_id参数
    if (useCookiePool && selectedCookieId) {
      streamUrl += `&cookie_id=${encodeURIComponent(selectedCookieId)}`;
      console.log(`[音频URL] 使用Cookie池ID请求: ${streamUrl}`);
    }

    console.log(`🎵 正在获取《${song.title}》的音频流:`, {
      mid,
      originalSongId: song.id,
      originalSongMid: song.mid,
      quality,
      useCookiePool,
      hasCookieId: !!selectedCookieId,
      hasCookie: !!cookie,
      url: streamUrl,
    });

    // 构建请求头
    const headers: Record<string, string> = {
      Range: "bytes=0-1023",
      "User-Agent": USER_AGENTS.DESKTOP,
    };

    // 只有在不使用Cookie池时才添加cookie头
    if (!useCookiePool && cookie) {
      headers[HTTP_HEADERS.QQ_COOKIE] = cookie;
    }

    // 验证流式播放URL是否可访问
    const response = await fetch(streamUrl, {
      method: "HEAD",
      headers: headers,
    });

    if (response.ok) {
      // 解析音质信息
      const qualityInfo = parseQualityInfo(response);

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
