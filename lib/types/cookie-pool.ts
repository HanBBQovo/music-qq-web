/**
 * Cookie池类型定义
 */

// Cookie池条目
export interface CookiePoolItem {
  id: string; // 唯一标识符
  cookie: string; // Cookie内容（API返回时会被遮蔽为******）
  nickname: string; // 用户昵称
  vip_level: string; // VIP等级（绿钻、豪华绿钻等）
  status: "active" | "error"; // 状态
  added_time: string; // 添加时间
  last_check: string; // 上次检查时间
  success_count: number; // 成功使用次数
  failure_count: number; // 失败次数
}

// Cookie提交请求
// Cookie提交响应
export interface SubmitCookieResponse {
  code: number;
  message: string;
  data?: {
    cookie_id: string; // 生成的Cookie ID
  };
}

// Cookie列表响应
export interface CookieListResponse {
  code: number;
  message: string;
  data?: {
    total: number; // 总数
    active: number; // 活跃数
    cookies: CookiePoolItem[]; // Cookie列表
  };
}

// Cookie统计响应
export interface CookieStatsResponse {
  code: number;
  message: string;
  data?: {
    total_count: number; // 总数
    active_count: number; // 活跃数
    error_count: number; // 错误数
  };
}
