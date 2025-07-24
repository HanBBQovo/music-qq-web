/**
 * 音频URL获取工具
 * 对接真实的音乐流式播放API
 */

import type { Song } from "../types/music";
import type { AudioQuality } from "../api/types";
import { musicApi } from "../api/client";

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

  const mid = song.mid || song.id || "";
  if (!mid) throw new Error("歌曲MID不能为空");

  const settingsStr = localStorage.getItem("settings-store");
  let useCookiePool = false;
  let selectedCookieId = "";

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

  console.log(`🎵 正在获取《${song.title}》的音频流信息，音质: ${requestedQuality}`);

  // 获取音频流信息
  const streamInfoResponse = await musicApi.getStreamInfo({
    mid,
    quality: requestedQuality, // 传递请求的音质
    cookie_id: useCookiePool ? selectedCookieId : undefined,
  });

  if (streamInfoResponse.code !== 0 || !streamInfoResponse.data) {
    throw new Error(`获取音频流信息失败: ${streamInfoResponse.message}`);
  }

  const streamInfo = streamInfoResponse.data;
  const availableQualities = streamInfo.qualities.qualities.map((q) => q.quality) as AudioQuality[];
  
  // 检查是否发生了音质降级
  const actualQuality = streamInfo.quality as AudioQuality;
  const requestedQualityFromInfo = streamInfo.requestedQuality as AudioQuality;
  const qualityFallback = streamInfo.qualityFallback;
  
  // 从请求的音质开始尝试，如果不可用则按优先级降级
  const startIndex = qualityPriority.indexOf(requestedQuality);
  const qualitiesToTry = startIndex !== -1 
    ? qualityPriority.slice(startIndex).filter(q => availableQualities.includes(q))
    : availableQualities.filter(q => qualityPriority.includes(q));

  if (qualitiesToTry.length === 0) {
    throw new Error(`没有可用的音质选项`);
  }

  // 使用服务器返回的实际音质，如果没有则使用我们的降级逻辑
  const finalQuality = actualQuality || qualitiesToTry[0];
  const qualityDetail = streamInfo.qualities.qualities.find(q => q.quality === finalQuality);

  if (!qualityDetail) {
    throw new Error(`找不到音质 ${finalQuality} 的详细信息`);
  }

  // 直接使用服务器返回的音频URL
  const streamUrl = qualityDetail.url;

  // 构建音质信息，使用服务器返回的完整信息
  const qualityInfo: QualityInfo = {
    availableQualities,
    qualitySizes: Object.fromEntries(
      streamInfo.qualities.qualities.map(q => [q.quality, q.fileSize]) // 使用正确的字段名 fileSize
    ),
    recommendedQuality: streamInfo.qualities.recommended as AudioQuality,
    qualityDetails: Object.fromEntries(
      streamInfo.qualities.qualities.map(q => [
        q.quality,
        {
          size: q.fileSize, // 使用正确的字段名 fileSize
          format: q.format,
          isVip: q.vipRequired, // 使用正确的字段名 vipRequired
          description: q.displayName || getQualityDisplayName(q.quality), // 优先使用服务器返回的 displayName
        }
      ])
    ),
  };

  // 如果有总文件大小信息，也包含进去
  if (streamInfo.contentLength && streamInfo.contentLength > 0) {
    qualityInfo.qualitySizes[finalQuality] = streamInfo.contentLength;
    if (qualityInfo.qualityDetails[finalQuality]) {
      qualityInfo.qualityDetails[finalQuality].size = streamInfo.contentLength;
    }
  }

  // 触发事件
  if (typeof window !== "undefined") {
    // 使用服务器返回的降级信息，或者我们自己的判断
    const shouldTriggerFallback = qualityFallback || (finalQuality !== requestedQuality);
    
    if (shouldTriggerFallback) {
      window.dispatchEvent(
        new CustomEvent("quality-fallback", {
          detail: {
            songId: mid,
            requestedQuality: requestedQualityFromInfo || requestedQuality,
            actualQuality: finalQuality,
            fallbackReason: qualityFallback 
              ? `服务器自动降级：音质 ${requestedQualityFromInfo || requestedQuality} 不可用，已降级到 ${finalQuality}`
              : `音质 ${requestedQuality} 不可用，已降级到 ${finalQuality}`,
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

  console.log(`✅ 音质 ${finalQuality} 可用，URL: ${streamUrl}`);
  return streamUrl;
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
