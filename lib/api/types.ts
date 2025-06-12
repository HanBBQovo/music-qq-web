/**
 * API类型定义
 */

// 歌手信息
export interface Singer {
  id: number;
  mid: string;
  name: string;
  title?: string;
  type?: number;
  uin?: number;
  pmid?: string;
}

// 专辑信息
export interface Album {
  id: number;
  mid: string;
  name: string;
  cover?: string;
  pmid?: string;
  time_public?: string;
}

// 歌曲信息
export interface Song {
  id: string;
  mid: string;
  name: string;
  singer: Singer[];
  album: Album;
  duration: number;
  vip: boolean;
  pay: {
    pay_play: number;
    pay_download: number;
  };
  size: {
    size128: number;
    size320: number;
    sizeape: number;
    sizeflac: number;
  };
}

// 专辑搜索结果项
export interface AlbumSearchItem {
  id: number;
  mid: string;
  name: string;
  picUrl?: string;
  releaseTime?: string;
  songCount?: number;
  singers?: Singer[];
}

// 歌单搜索结果项
export interface PlaylistSearchItem {
  id: number;
  mid: string;
  name: string;
  desc?: string;
  picUrl?: string;
  songCount?: number;
  creator?: {
    name: string;
    id: number;
    mid: string;
  };
  playCount?: number;
  createTime?: string;
}

// 歌曲搜索结果
export interface SongSearchResult {
  type: "song";
  songs: Song[];
  total: number;
  hasMore: boolean;
}

// 专辑搜索结果
export interface AlbumSearchResult {
  type: "album";
  albums: AlbumSearchItem[];
  total: number;
  hasMore: boolean;
}

// 歌单搜索结果
export interface PlaylistSearchResult {
  type: "playlist";
  playlists: PlaylistSearchItem[];
  total: number;
  hasMore: boolean;
}

// 统一搜索结果类型
export type SearchResult =
  | SongSearchResult
  | AlbumSearchResult
  | PlaylistSearchResult;

// 歌词类型
export interface Lyric {
  lyric: string;
  trans?: string;
}

// 音质选项
export type AudioQuality =
  | "128"
  | "320"
  | "flac"
  | "ATMOS_2"
  | "ATMOS_51"
  | "MASTER";

// 音质信息
export interface QualityInfo {
  size: number;
  extension: string;
  displayName: string;
  quality: string;
  vip: boolean;
}

// 歌曲下载URL信息
export interface SongUrlInfo {
  code: number;
  url?: string;
  mid: string;
  quality?: string;
  actualQuality?: string;
  requestedQuality?: string;
  type?: string;
  size?: number;
  bitrate?: string;
  formatName?: string;
  message?: string;
  data?: any;
  fileExtension?: string;
  formatMatches?: boolean;
  qualityAvailable?: boolean;
  vipRequired?: boolean;
}

// 歌单信息
export interface Playlist {
  id: number;
  mid: string;
  name: string;
  desc: string;
  logo: string;
  creator: {
    name: string;
    id: number;
    mid: string;
  };
  songlist: Song[];
  songnum: number;
  create_time: string;
  update_time: string;
}

// 专辑详情
export interface AlbumDetail extends Album {
  description?: string;
  releaseTime?: string;
  cover?: string;
  songs?: Song[];
  songCount: number;
}

// 下载任务状态
export type DownloadStatus =
  | "pending"
  | "downloading"
  | "paused"
  | "completed"
  | "error";

// 下载任务信息
export interface DownloadTask {
  id: string;
  songId: string;
  songMid: string;
  songName: string;
  artist: string;
  albumName: string;
  albumMid?: string;
  quality: AudioQuality;
  actualQuality?: AudioQuality;
  wasDowngraded?: boolean;
  progress: number;
  status: DownloadStatus;
  filePath?: string;
  fileSize?: number;
  bytesLoaded?: number;
  totalBytes?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  lastProgressUpdate?: number;
  lastBytesLoaded?: number;
}

// API错误
export interface ApiError {
  code: number;
  message: string;
}

// 用户设置
export interface UserSettings {
  cookie?: string;
  defaultQuality: AudioQuality;
  saveLocation?: string;
  autoAddMetadata: boolean;
  autoAddCover: boolean;
}

// 搜索参数接口
export interface SearchParams {
  key: string;
  page?: number;
  pageSize?: number;
  type?: string;
  cookie_id?: string;
}

// 搜索响应接口
export interface SearchResponse {
  code: number;
  data: SearchResult;
  message: string;
}

// 歌曲详情参数接口
export interface SongDetailParams {
  id?: string;
  mid?: string;
  cookie_id?: string;
}

// 歌曲详情响应接口
export interface SongDetailResponse {
  code: number;
  data: Song;
  message: string;
}

// 歌曲URL参数
export interface SongUrlParams {
  mid: string;
  quality?: AudioQuality;
  cookie?: string;
  cookie_id?: string;
  enableFallback?: boolean;
}

// 歌曲URL响应
export interface SongUrlResponse {
  code: number;
  message: string;
  data: SongUrlInfo | null;
}

// 歌词参数接口
export interface LyricParams {
  id?: string;
  mid?: string;
  cookie_id?: string;
}

// 歌词响应接口
export interface LyricResponse {
  code: number;
  data: Lyric;
  message: string;
}

// 专辑参数接口
export interface AlbumParams {
  id?: number;
  mid?: string;
  cookie_id?: string;
}

// 专辑响应接口
export interface AlbumResponse {
  code: number;
  data: AlbumDetail;
  message: string;
}

// 歌单参数接口
export interface PlaylistParams {
  id?: number | string;
  mid?: string;
  cookie_id?: string;
}

// 歌单响应接口
export interface PlaylistResponse {
  code: number;
  data: Playlist;
  message: string;
}

// 通用API响应接口
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}
