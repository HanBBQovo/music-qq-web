/**
 * 将字节数格式化为易读的字符串，如 "1.2 MB"。
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${sizes[i]}`;
}

/**
 * 按网络速率格式化，返回 "1.5 MB/s" 等。
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return "0 B/s";
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  } else if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${Math.round(bytesPerSecond)} B/s`;
}

/**
 * 将剩余秒数格式化为中文，如 "3分钟"、"2小时"。
 */
export function formatTimeRemaining(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  return `${Math.floor(seconds / 3600)}小时`;
}

/**
 * 根据后端音质编码返回可读名称。
 */
export function getQualityDisplayName(quality: string): string {
  switch (quality) {
    case "128":
      return "MP3 (128kbps)";
    case "320":
      return "MP3 (320kbps)";
    case "flac":
      return "FLAC 无损";
    case "ATMOS_51":
      return "臻品音质2.0";
    case "ATMOS_2":
      return "臻品全景声2.0";
    case "MASTER":
      return "臻品母带2.0";
    default:
      return quality;
  }
}
