import type { Song, PlayMode } from "@/lib/types/music";
import type { AudioQuality, LyricLine } from "@/lib/api/types";

// 单个 slice 的接口定义

export interface PlaybackSlice {
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

export interface PlaylistSlice {
  playlist: Song[];
  currentIndex: number;
  currentSong: Song | null;
  playMode: PlayMode;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  playAtIndex: (index: number) => Promise<void>;
  setPlayMode: (mode: PlayMode) => void;
  addToPlaylist: (song: Song) => void;
  addMultipleToPlaylist: (songs: Song[]) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
  moveInPlaylist: (fromIndex: number, toIndex: number) => void;
  _getNextIndex: () => number;
  _getPreviousIndex: () => number;
}

export interface QualitySlice {
  currentQuality: AudioQuality;
  availableQualities: AudioQuality[];
  qualitySizes: Record<string, number>;
  recommendedQuality: AudioQuality | null;
  setCurrentQuality: (quality: AudioQuality) => Promise<void>;
}

export interface LyricSlice {
  krcLyrics: LyricLine[] | null;
  isKrcLyricsLoading: boolean;
  krcLyricsError: string | null;
}

export interface UISlice {
  showPlayer: boolean;
  showPlaylist: boolean;
  setShowPlayer: (show: boolean) => void;
  setShowPlaylist: (show: boolean) => void;
}

// 组合后的完整 State 接口
// 这里包含所有 slice 的属性，以及那些需要跨 slice 交互的复杂 action
export interface PlayerStoreState
  extends PlaybackSlice,
    PlaylistSlice,
    QualitySlice,
    LyricSlice,
    UISlice {
  // 复杂的、跨 slice 的 actions
  playSong: (song: Song, quality?: AudioQuality) => Promise<void>;
  playSongList: (songs: Song[], startIndex?: number) => Promise<void>;
  fetchKrcLyrics: (force?: boolean) => Promise<void>;
  switchQuality: (quality: AudioQuality) => Promise<void>;
}
