// 音乐歌曲类型定义
export interface Song {
  id: string;
  mid?: string; // 音乐平台的歌曲MID
  title: string;
  artist: string;
  album: string;
  cover?: string;
  duration: number;
  url?: string;
  source: string; // 音乐来源标识
  quality?: string; // 音质设置
  error?: string; // 错误信息
}

// 播放模式类型
export type PlayMode = "order" | "random" | "loop";

// 播放器状态枚举
export enum PlayerStatus {
  IDLE = "idle",
  LOADING = "loading",
  PLAYING = "playing",
  PAUSED = "paused",
  ENDED = "ended",
  ERROR = "error",
}

// 音频质量枚举
export enum AudioQuality {
  STANDARD = "standard", // 标准音质
  HIGH = "high", // 高音质
  LOSSLESS = "lossless", // 无损音质
  MASTER = "master", // 母带音质
}

// 搜索结果类型（与现有系统兼容）
export interface SearchResultItem {
  id: string;
  name: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: number;
  url?: string;
  [key: string]: any; // 兼容现有搜索结果的其他字段
}

// 播放错误类型
export interface PlayError {
  code: string;
  message: string;
  song?: Song;
}

// 播放统计信息
export interface PlayStats {
  totalPlayed: number;
  totalDuration: number;
  favoriteCount: number;
  historyCount: number;
}

// 播放列表信息
export interface PlaylistInfo {
  name: string;
  songs: Song[];
  createdAt?: Date;
  updatedAt?: Date;
}

// 本地存储键名常量
export const STORAGE_KEYS = {
  PLAYER_STATE: "music-player-storage",
  CACHE_SONGS: "music-cache-songs",
  USER_PREFERENCES: "music-user-preferences",
} as const;

// 播放器配置常量
export const PLAYER_CONFIG = {
  MAX_HISTORY_COUNT: 100,
  MAX_PLAYLIST_COUNT: 500,
  PRELOAD_NEXT_SONG: false,
  AUTO_PLAY_NEXT: true,
  FADE_DURATION: 300, // 毫秒
  SEEK_STEP: 10, // 秒
  VOLUME_STEP: 0.1,
} as const;

// 搜索结果转换为播放器歌曲格式的工具函数类型
export type SearchResultConverter = (item: SearchResultItem) => Song;

// 播放器事件类型
export interface PlayerEvents {
  onPlay?: (song: Song) => void;
  onPause?: (song: Song) => void;
  onNext?: (song: Song) => void;
  onPrevious?: (song: Song) => void;
  onEnd?: (song: Song) => void;
  onError?: (error: PlayError) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onVolumeChange?: (volume: number) => void;
}
