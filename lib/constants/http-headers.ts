/**
 * HTTP请求头常量定义
 * 统一管理项目中使用的HTTP头名称，避免命名不一致性
 */

// QQ音乐认证相关
export const HTTP_HEADERS = {
  // QQ音乐Cookie头（统一使用小写格式）
  QQ_COOKIE: "x-qq-cookie",

  // 其他常用头
  CONTENT_TYPE: "Content-Type",
  USER_AGENT: "User-Agent",
  RANGE: "Range",
  ACCEPT_RANGES: "Accept-Ranges",
  CONTENT_RANGE: "Content-Range",
  CONTENT_LENGTH: "Content-Length",
} as const;

// 内容类型常量
export const CONTENT_TYPES = {
  JSON: "application/json",
  FORM_URLENCODED: "application/x-www-form-urlencoded",
} as const;

// 用户代理字符串
export const USER_AGENTS = {
  DESKTOP: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  MOBILE:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
} as const;
