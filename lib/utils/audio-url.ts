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

const qualityPriority: AudioQuality[] = [
  "ATMOS_51",
  "ATMOS_2",
  "MASTER",
  "flac",
  "320",
  "128",
];

/**
 * 获取歌曲的音频流URL
 * @param song 歌曲信息
 * @param requestedQuality 请求的音质（默认320）
 * @returns Promise<string> 音频流URL
 */
export async function getAudioUrl(
  song: Song,
  requestedQuality: AudioQuality = "320"
): Promise<string> {
  if (song.url && song.url.includes(`quality=${requestedQuality}`)) {
    // 如果URL存在且音质匹配，可以先尝试验证一下
    try {
      const headResponse = await fetch(song.url, { method: "HEAD" });
      if (headResponse.ok) return song.url;
    } catch (e) {
      // 验证失败，继续执行获取逻辑
    }
  }

  let mid = song.mid || song.id || "";
  if (!mid) throw new Error("歌曲MID不能为空");

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

  if (!useCookiePool) {
    cookie = getQQCookie();
  }

  const startIndex = qualityPriority.indexOf(requestedQuality);
  if (startIndex === -1) {
    // 如果请求的音质不在优先级列表中，从最高音质开始尝试
    console.warn(`请求的音质 ${requestedQuality} 无效，将从最高音质开始尝试。`);
  }

  const qualitiesToTry =
    startIndex !== -1
      ? qualityPriority.slice(startIndex)
      : [...qualityPriority];

  for (const currentQuality of qualitiesToTry) {
    try {
      let streamUrl = buildApiUrl(
        `/api/play/stream?mid=${encodeURIComponent(
          mid
        )}&quality=${currentQuality}&autoFallback=false&redirect=true` // 禁用后端自动降级
      );

      if (useCookiePool && selectedCookieId) {
        streamUrl += `&cookie_id=${encodeURIComponent(selectedCookieId)}`;
      }

      console.log(
        `🎵 正在尝试获取《${song.title}》的音频流，音质: ${currentQuality}`
      );

      const headers: Record<string, string> = {
        Range: "bytes=0-1",
        "User-Agent": USER_AGENTS.DESKTOP,
      };

      if (!useCookiePool && cookie) {
        headers[HTTP_HEADERS.QQ_COOKIE] = cookie;
      }

      const response = await fetch(streamUrl, {
        method: "HEAD",
        headers: {
          ...headers,
          // 明确告诉后端我们需要元数据，不需要重定向
          'X-Request-Type': 'metadata',
        },
      });

      // 检查是否是302重定向（在Netlify部署环境中常见）
      if (response.status === 302) {
        const location = response.headers.get('location');
        if (location) {
          console.log(`✅ 音质 ${currentQuality} 可用（重定向），URL: ${location}`);
          
          // 对于重定向的情况，尝试获取元数据信息
          try {
            // 修改URL参数，请求元数据而不是重定向
            const metadataUrl = streamUrl.replace('redirect=true', 'redirect=false');
            const metadataResponse = await fetch(metadataUrl, {
              method: "HEAD",
              headers: headers,
            });
            
            if (metadataResponse.ok) {
              const qualityInfo = parseQualityInfo(metadataResponse);
              
              if (typeof window !== "undefined") {
                if (currentQuality !== requestedQuality) {
                  window.dispatchEvent(
                    new CustomEvent("quality-fallback", {
                      detail: {
                        songId: mid,
                        requestedQuality,
                        actualQuality: currentQuality,
                        fallbackReason: metadataResponse.headers.get("X-Fallback-Reason") || `音质 ${requestedQuality} 不可用`,
                      },
                    })
                  );
                }
                window.dispatchEvent(
                  new CustomEvent("quality-info-updated", {
                    detail: {
                      songId: mid,
                      qualityInfo,
                    },
                  })
                );
              }
            }
          } catch (metadataError) {
            console.warn('获取音质元数据失败:', metadataError);
          }
          
          return location;
        }
      }

      if (response.ok) {
        console.log(`✅ 音质 ${currentQuality} 可用，URL: ${streamUrl}`);
        const qualityInfo = parseQualityInfo(response);

        if (typeof window !== "undefined") {
          if (currentQuality !== requestedQuality) {
            window.dispatchEvent(
              new CustomEvent("quality-fallback", {
                detail: {
                  songId: mid,
                  requestedQuality,
                  actualQuality: currentQuality,
                  fallbackReason: `音质 ${requestedQuality} 不可用`,
                },
              })
            );
          }
          window.dispatchEvent(
            new CustomEvent("quality-info-updated", {
              detail: { songId: mid, qualityInfo },
            })
          );
        }

        return streamUrl;
      } else {
        const errorMessage =
          response.headers.get("x-error-message") || `HTTP ${response.status}`;
        let decodedMessage = errorMessage;
        if (
          /^[A-Za-z0-9+/]+=*$/.test(errorMessage) &&
          errorMessage.length > 20
        ) {
          try {
            decodedMessage = decodeURIComponent(escape(atob(errorMessage)));
          } catch (e) {
            // 解码失败，使用原信息
          }
        }
        throw new Error(`音质 ${currentQuality} 不可用: ${decodedMessage}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`⚠️ ${error.message}`);
      }
      if (currentQuality === qualitiesToTry[qualitiesToTry.length - 1]) {
        toast.error(`播放失败: ${song.title}`, {
          description: "所有可用音质均尝试失败。",
        });
        throw new Error(`获取《${song.title}》音频流失败，所有音质均不可用。`);
      }
    }
  }

  // 理论上不会执行到这里，因为上面的循环要么返回要么抛出错误
  throw new Error(`无法为《${song.title}》获取任何有效的音频流。`);
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
