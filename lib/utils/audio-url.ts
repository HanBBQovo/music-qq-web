/**
 * 音频URL获取工具
 * 对接真实的QQ音乐流式播放API
 */

import type { Song } from "../types/music";
import type { AudioQuality } from "../api/types";

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
        "X-QQ-Cookie": cookie,
        Range: "bytes=0-1023",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (response.ok) {
      console.log(`✅ 成功获取《${song.title}》的音频流URL`);
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
          "X-QQ-Cookie": cookie,
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
        "X-QQ-Cookie": cookie,
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
        "X-QQ-Cookie": cookie,
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
