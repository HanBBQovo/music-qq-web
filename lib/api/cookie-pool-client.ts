import axios from "axios";
import {
  SubmitCookieRequest,
  SubmitCookieResponse,
  CookieListResponse,
  CookieStatsResponse,
  CookiePoolItem,
} from "../types/cookie-pool";

// API基础URL，与主API使用相同的基础URL
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Cookie池API客户端
 */
export const cookiePoolApi = {
  /**
   * 提交Cookie到池中
   * @param cookie 音乐Cookie字符串
   * @returns 响应对象，包含cookie_id
   */
  submitCookie: async (cookie: string): Promise<SubmitCookieResponse> => {
    try {
      console.log("[Cookie池API] 提交Cookie");

      const response = await fetch(`${BASE_URL}/api/cookie/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cookie }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Cookie池API] 提交Cookie失败:", error);
      throw error;
    }
  },

  /**
   * 获取Cookie池列表
   * @returns 包含Cookie列表的响应
   */
  getCookieList: async (): Promise<CookieListResponse> => {
    try {
      console.log("[Cookie池API] 获取Cookie列表");

      const response = await fetch(`${BASE_URL}/api/cookie/list`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Cookie池API] 获取Cookie列表失败:", error);
      throw error;
    }
  },

  /**
   * 获取Cookie池统计信息
   * @returns 包含统计信息的响应
   */
  getCookieStats: async (): Promise<CookieStatsResponse> => {
    try {
      console.log("[Cookie池API] 获取Cookie统计");

      const response = await fetch(`${BASE_URL}/api/cookie/stats`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Cookie池API] 获取Cookie统计失败:", error);
      throw error;
    }
  },
};

export default cookiePoolApi;
