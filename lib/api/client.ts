import axios, { AxiosRequestConfig, AxiosError } from "axios";
import { toast } from "sonner";
import type {
  SearchParams,
  SearchResponse,
  SongDetailParams,
  SongDetailResponse,
  SongUrlParams,
  SongUrlResponse,
  SongUrlInfo,
  LyricParams,
  LyricResponse,
  AlbumParams,
  AlbumResponse,
  PlaylistParams,
  PlaylistResponse,
} from "./types";
import { HTTP_HEADERS } from "@/lib/constants/http-headers";

// API基础URL，指向Cloudflare Workers服务
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// 最大重试次数
const MAX_RETRIES = 2;
// 重试延迟（毫秒）
const RETRY_DELAY = 1000;

// 创建axios实例
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // 自动处理cookie
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 从localStorage获取设置，检查是否使用Cookie池
    const settingsStr = localStorage.getItem("settings-store");
    let useCookiePool = false;

    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        useCookiePool = settings.state?.useCookiePool || false;
      } catch (e) {
        console.error("[API请求] 解析设置失败:", e);
      }
    }

    // 仅在不使用Cookie池时才添加Cookie头
    if (!useCookiePool) {
      // 从localStorage获取Cookie，使用自定义头传递（浏览器不允许直接设置Cookie头）
      const cookie = localStorage.getItem("music_cookie");
      if (cookie && config.headers) {
        config.headers[HTTP_HEADERS.QQ_COOKIE] = cookie;
      }

      // 仅在开发环境记录详细日志
      if (process.env.NODE_ENV === "development") {
        console.log("[API请求] 使用自定义Cookie");
        if (cookie) {
          console.log(`[API请求] Cookie长度: ${cookie.length}`);
        }
      }
    } else {
      // 使用Cookie池模式，不添加Cookie头
      if (process.env.NODE_ENV === "development") {
        console.log("[API请求] 使用Cookie池模式，不添加Cookie头");
      }
    }

    // 仅在开发环境记录详细日志
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[API请求] ${config.method?.toUpperCase()} ${config.url}`,
        config.params || config.data
      );
    }
    return config;
  },
  (error) => {
    console.error("[API请求错误]", error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    // 仅在开发环境记录详细日志
    if (process.env.NODE_ENV === "development") {
      console.log(`[API响应] 状态: ${response.status}`, response.data);
    }

    // 检查响应数据是否符合预期格式
    if (response.data && typeof response.data === "object") {
      return response.data;
    }

    // 如果响应数据不符合预期格式，返回一个统一格式的对象
    if (process.env.NODE_ENV === "development") {
      console.warn("[API响应] 响应数据格式不符合预期", response.data);
    }

    return {
      code: 0,
      data: response.data,
      message: "success",
    };
  },
  (error) => {
    // 详细记录错误信息
    console.error("[API响应错误]", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // 提取错误信息
    const errorMsg =
      error.response?.data?.message || error.message || "请求失败，请稍后重试";

    // 只有在非取消请求的情况下才显示错误提示
    if (!axios.isCancel(error)) {
      toast.error(`请求错误: ${errorMsg}`);
    }

    return Promise.reject(error);
  }
);

/**
 * 带重试功能的API请求函数
 */
async function requestWithRetry<T>(
  requestFn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await requestFn();
  } catch (error) {
    // 如果是取消的请求，不重试
    if (axios.isCancel(error as Error)) {
      throw error;
    }

    // 如果是网络错误或超时错误，并且还有重试次数，则重试
    const isNetworkOrTimeoutError =
      error instanceof Error &&
      (error.message.includes("Network Error") ||
        error.message.includes("timeout"));

    if (isNetworkOrTimeoutError && retries > 0) {
      console.log(`[API重试] 剩余重试次数: ${retries}`);

      // 等待一段时间后重试
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

      // 递归调用，减少重试次数
      return requestWithRetry(requestFn, retries - 1);
    }

    // 如果不符合重试条件或重试次数已用完，则抛出错误
    throw error;
  }
}

// API方法
export const musicApi = {
  // 搜索音乐
  search: async (params: SearchParams): Promise<SearchResponse> => {
    return requestWithRetry(async () => {
      try {
        // 检查是否使用Cookie池
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
            console.error("[API客户端] 解析设置失败:", e);
          }
        }

        // 如果使用Cookie池，添加cookie_id参数
        if (useCookiePool && selectedCookieId) {
          params.cookie_id = selectedCookieId;
        }

        if (process.env.NODE_ENV === "development") {
          console.log("[搜索API] 请求参数:", params);
        }

        const response = await apiClient.get<SearchResponse>("/api/search", {
          params,
        });

        if (process.env.NODE_ENV === "development") {
          console.log("[搜索API] 响应数据:", response);
        }

        // 验证响应格式
        if (!response || typeof response !== "object") {
          throw new Error("搜索响应格式无效");
        }

        // 确保响应对象具有所需的字段
        const searchResponse = response as unknown as SearchResponse;

        // 如果响应没有code字段，添加默认值
        if (searchResponse.code === undefined) {
          searchResponse.code = 0;
        }

        return searchResponse;
      } catch (error) {
        console.error("[搜索API] 搜索请求失败:", error);
        throw error;
      }
    });
  },

  // 获取歌曲详情
  getSongDetail: async (
    params: SongDetailParams
  ): Promise<SongDetailResponse> => {
    return requestWithRetry(async () => {
      try {
        // 检查是否使用Cookie池
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
            console.error("[API客户端] 解析设置失败:", e);
          }
        }

        // 如果使用Cookie池，添加cookie_id参数
        if (useCookiePool && selectedCookieId) {
          params.cookie_id = selectedCookieId;
        }

        return await apiClient.get("/api/song/detail", { params });
      } catch (error) {
        console.error("获取歌曲详情失败:", error);
        throw error;
      }
    });
  },

  /**
   * 获取歌曲下载URL
   * @param params 歌曲URL参数
   * @returns 歌曲URL信息
   */
  getSongUrl: async (params: SongUrlParams): Promise<SongUrlResponse> => {
    try {
      // 检查是否使用Cookie池
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
          console.error("[API客户端] 解析设置失败:", e);
        }
      }

      // 根据模式设置参数
      let cookieParam = "";
      let cookieIdParam = "";

      if (useCookiePool) {
        // Cookie池模式：使用cookie_id，不使用cookie
        cookieIdParam = selectedCookieId || params.cookie_id || "";
        cookieParam = ""; // 确保不发送cookie
      } else {
        // 自定义Cookie模式：使用cookie，不使用cookie_id
        cookieParam =
          params.cookie || localStorage.getItem("music_cookie") || "";
        cookieIdParam = ""; // 确保不发送cookie_id
      }

      // 更详细的日志记录，特别是cookie_id参数
      console.log("[API客户端] 获取歌曲URL详细参数:", {
        mid: params.mid,
        quality: params.quality || "320",
        enableFallback: params.enableFallback || false,
        useCookiePool: useCookiePool,
        hasCookie: !!cookieParam,
        cookieLength: cookieParam?.length || 0,
        hasCookieId: !!cookieIdParam,
        cookieId: cookieIdParam || "未指定", // 记录具体的cookie_id值
        usePool: !!cookieIdParam, // 是否使用Cookie池
      });

      const response = await fetch(`${BASE_URL}/api/song/url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mid: params.mid,
          quality: params.quality || "320",
          cookie: cookieParam,
          cookie_id: cookieIdParam,
          enableFallback: params.enableFallback || false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[API客户端] 歌曲URL响应:", {
        code: data.code,
        hasUrl: !!data.data?.url,
        actualQuality: data.data?.actualQuality,
        requestedQuality: data.data?.requestedQuality,
        formatMatches: data.data?.formatMatches,
        usedCookieId: cookieIdParam || "未使用", // 记录使用的cookie_id
      });

      return data;
    } catch (error) {
      console.error("[API客户端] 获取歌曲URL失败:", error);
      throw error;
    }
  },

  // 获取歌词
  getLyric: async (params: LyricParams): Promise<LyricResponse> => {
    return requestWithRetry(async () => {
      try {
        // 检查是否使用Cookie池
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
            console.error("[API客户端] 解析设置失败:", e);
          }
        }

        // 如果使用Cookie池，添加cookie_id参数
        if (useCookiePool && selectedCookieId) {
          params.cookie_id = selectedCookieId;
        }

        return await apiClient.get("/api/lyric", { params });
      } catch (error) {
        console.error("获取歌词失败:", error);
        throw error;
      }
    });
  },

  // 获取专辑信息
  getAlbum: async (params: AlbumParams): Promise<AlbumResponse> => {
    return requestWithRetry(async () => {
      try {
        // 检查是否使用Cookie池
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
            console.error("[API客户端] 解析设置失败:", e);
          }
        }

        // 如果使用Cookie池，添加cookie_id参数
        if (useCookiePool && selectedCookieId) {
          params.cookie_id = selectedCookieId;
        }

        return await apiClient.get("/api/album", { params });
      } catch (error) {
        console.error("获取专辑信息失败:", error);
        throw error;
      }
    });
  },

  // 获取歌单信息
  getPlaylist: async (params: PlaylistParams): Promise<PlaylistResponse> => {
    return requestWithRetry(async () => {
      try {
        // 检查是否使用Cookie池
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
            console.error("[API客户端] 解析设置失败:", e);
          }
        }

        // 如果使用Cookie池，添加cookie_id参数
        if (useCookiePool && selectedCookieId) {
          params.cookie_id = selectedCookieId;
        }

        return await apiClient.get("/api/playlist", { params });
      } catch (error) {
        console.error("获取歌单信息失败:", error);
        throw error;
      }
    });
  },

  // 获取文件大小（HEAD请求）
  getFileSize: async (
    url: string
  ): Promise<{ size: number | null; error?: string }> => {
    try {
      console.log(`[API] 预获取文件大小: ${url.substring(0, 50)}...`);

      const response = await fetch(url, {
        method: "HEAD",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        console.warn(
          `[API] HEAD请求失败: ${response.status} ${response.statusText}`
        );
        return { size: null, error: `HTTP ${response.status}` };
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const size = parseInt(contentLength);
        console.log(`[API] 成功获取文件大小: ${size} bytes`);
        return { size };
      } else {
        console.warn(`[API] 响应中没有Content-Length头`);
        return { size: null, error: "No Content-Length header" };
      }
    } catch (error) {
      console.error(`[API] 获取文件大小失败:`, error);
      return {
        size: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  // 获取歌曲音频流URL
  getStreamUrl: (
    url: string,
    songMid: string,
    songName?: string,
    artist?: string,
    albumMid?: string,
    metadata: boolean = false,
    cookieId?: string
  ): string => {
    // 检查BASE_URL是否为相对路径
    let baseUrl = BASE_URL;

    // 构建音频流URL - 处理不同环境下的URL构造
    let streamUrlString = "";

    // 针对Vercel部署环境特殊处理
    if (baseUrl === "/music-api") {
      if (typeof window !== "undefined") {
        // 客户端环境，使用完整URL
        streamUrlString = `${window.location.origin}/music-api/api/stream`;
      } else {
        // 服务器端渲染环境
        streamUrlString = "/music-api/api/stream";
      }
    }
    // 处理标准开发环境（完整URL）
    else if (
      baseUrl &&
      (baseUrl.includes("://") || baseUrl.startsWith("http"))
    ) {
      // BASE_URL是完整URL
      streamUrlString = `${baseUrl}/api/stream`;
    }
    // 处理其他情况
    else {
      if (typeof window !== "undefined") {
        // 客户端环境，使用当前域名
        streamUrlString = `${window.location.origin}/api/stream`;
      } else {
        // 服务器端渲染环境
        streamUrlString = "/api/stream";
      }
    }

    // 创建URL对象并添加查询参数
    const streamUrl = new URL(streamUrlString);
    streamUrl.searchParams.append("url", encodeURIComponent(url));
    streamUrl.searchParams.append("songMid", songMid);
    if (songName) streamUrl.searchParams.append("songName", songName);
    if (artist) streamUrl.searchParams.append("artist", artist);
    if (albumMid) streamUrl.searchParams.append("albumMid", albumMid);
    streamUrl.searchParams.append("metadata", metadata ? "true" : "false");
    streamUrl.searchParams.append("redirect", "true");

    // 如果提供了 cookie_id，添加到查询参数
    if (cookieId) {
      streamUrl.searchParams.append("cookie_id", cookieId);
      console.log(`[API] 添加cookie_id参数: ${cookieId}`);
    }

    // 打印调试信息
    console.log(
      `[API] 构造流URL: BASE_URL=${BASE_URL}, 最终URL=${streamUrl.toString()}`
    );

    return streamUrl.toString();
  },
};

export default musicApi;
