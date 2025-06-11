"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Song,
  AudioQuality,
  AlbumSearchItem,
  PlaylistSearchItem,
} from "@/lib/api/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DownloadIcon,
  LoaderIcon,
  XCircleIcon,
  ChevronRightIcon,
  CalendarIcon,
  Music,
  User,
  PlayIcon,
  Pause,
  ListMusic,
} from "lucide-react";
import {
  useSearchStore,
  useDownloadStore,
  useSearchResults,
} from "@/lib/store";
import { useSettingsStore } from "@/lib/store";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import type { Song as PlayerSong } from "@/lib/types/music";

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q");
  const type = searchParams.get("type");

  // 使用搜索和下载状态store
  const {
    songs,
    albums,
    playlists,
    total,
    hasMore,
    isLoading,
    isError,
    error,
    searchType,
  } = useSearchResults();
  const { loadMore, isLoadingMore } = useSearchStore();
  const { addTask } = useDownloadStore();

  // 获取用户设置中的默认音质
  const { defaultQuality } = useSettingsStore();

  // 播放器状态管理
  const {
    playSong,
    playSongList,
    addToPlaylist,
    addMultipleToPlaylist,
    currentSong,
    isPlaying,
    togglePlay,
  } = usePlayerStore();

  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  // 当搜索参数变化时重置选中状态
  useEffect(() => {
    setSelectedSongs([]);
  }, [query, type]);

  // 转换搜索结果歌曲为播放器歌曲格式
  function convertToPlayerSong(song: Song): PlayerSong {
    return {
      id: song.mid, // 播放器内部使用mid作为唯一标识
      mid: song.mid, // 保留mid字段给API调用
      title: song.name,
      artist: song.singer.map((s) => s.name).join(", "),
      album: song.album.name,
      cover: song.album.cover || undefined,
      duration: song.duration,
      url: undefined, // 需要通过后端API获取
      source: "qq-music",
    };
  }

  // 播放单首歌曲
  async function handlePlaySong(song: Song) {
    const loadingToast = toast.loading(`正在加载《${song.name}》...`);

    try {
      const playerSong = convertToPlayerSong(song);
      await playSong(playerSong);

      // 关闭加载提示并显示成功消息
      toast.dismiss(loadingToast);
      toast.success(`开始播放《${song.name}》`, {
        description: `歌手: ${song.singer.map((s) => s.name).join(", ")}`,
      });
    } catch (error) {
      // 关闭加载提示，错误信息由audio-url.ts统一显示
      toast.dismiss(loadingToast);
    }
  }

  // 批量添加到播放列表
  async function handleAddToPlaylist() {
    if (selectedSongs.length === 0) {
      toast.error("请先选择要添加的歌曲");
      return;
    }

    try {
      const selectedSongsData = songs.filter((song) =>
        selectedSongs.includes(song.id)
      );

      const playerSongs = selectedSongsData.map(convertToPlayerSong);
      addMultipleToPlaylist(playerSongs);

      toast.success(`已添加${selectedSongs.length}首歌曲到播放列表`);
      setSelectedSongs([]);
    } catch (error) {
      toast.error(`添加到播放列表失败: ${(error as Error).message}`);
    }
  }

  // 播放全部搜索结果
  async function handlePlayAllSongs() {
    if (songs.length === 0) {
      toast.error("没有可播放的歌曲");
      return;
    }

    const loadingToast = toast.loading(`正在加载播放列表...`);

    try {
      const playerSongs = songs.map(convertToPlayerSong);
      await playSongList(playerSongs, 0);

      // 关闭加载提示并显示成功消息
      toast.dismiss(loadingToast);
      toast.success(`开始播放搜索结果，共${songs.length}首歌曲`);
    } catch (error) {
      // 关闭加载提示，错误信息由audio-url.ts统一显示
      toast.dismiss(loadingToast);
    }
  }

  // 检查当前歌曲是否正在播放
  function isCurrentSongPlaying(song: Song): boolean {
    return currentSong?.mid === song.mid && isPlaying;
  }

  function handleSelectSong(songId: string) {
    setSelectedSongs((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  }

  function handleSelectAll() {
    if (selectedSongs.length === songs.length) {
      setSelectedSongs([]);
    } else {
      setSelectedSongs(songs.map((song) => song.id));
    }
  }

  async function handleDownload(song: Song, quality?: AudioQuality) {
    try {
      // 如果没有指定音质，使用用户设置的默认音质
      const selectedQuality = quality || defaultQuality;
      await addTask(song, selectedQuality);
      toast.success(`已添加《${song.name}》到下载队列`, {
        description: `歌手: ${song.singer
          .map((s) => s.name)
          .join(", ")}，音质: ${getQualityDisplayName(selectedQuality)}`,
      });
    } catch (error) {
      toast.error(`添加下载任务失败: ${(error as Error).message}`);
    }
  }

  async function handleBatchDownload() {
    if (selectedSongs.length === 0) {
      toast.error("请先选择要下载的歌曲");
      return;
    }

    try {
      const selectedSongsData = songs.filter((song) =>
        selectedSongs.includes(song.id)
      );

      // 逐个添加到下载队列，使用用户设置的默认音质
      for (const song of selectedSongsData) {
        await addTask(song, defaultQuality);
      }

      toast.success(`已添加${selectedSongs.length}首歌曲到下载队列`, {
        description: `音质: ${getQualityDisplayName(defaultQuality)}`,
      });

      // 清空选择
      setSelectedSongs([]);
    } catch (error) {
      toast.error(`批量添加下载任务失败: ${(error as Error).message}`);
    }
  }

  function handleLoadMore() {
    loadMore();
  }

  // 获取歌曲最高质量文件大小
  function getSongMaxSize(song: Song): number {
    return Math.max(
      song.size.size128 || 0,
      song.size.size320 || 0,
      song.size.sizeflac || 0,
      song.size.sizeape || 0
    );
  }

  // 添加音质显示名称函数
  function getQualityDisplayName(quality: string): string {
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

  // 格式化文件大小
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "未知";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // 格式化时长
  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // 格式化播放次数
  function formatPlayCount(count: number): string {
    if (count >= 100000000) {
      return (count / 100000000).toFixed(1) + "亿";
    } else if (count >= 10000) {
      return (count / 10000).toFixed(1) + "万";
    }
    return count.toString();
  }

  // 如果没有搜索参数，显示空状态
  if (!query || !type) {
    return null;
  }

  // 加载中状态
  if (
    isLoading &&
    songs.length === 0 &&
    albums.length === 0 &&
    playlists.length === 0
  ) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Card className="border border-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <LoaderIcon className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium">
              正在搜索&quot;{query}&quot;...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              从QQ音乐获取数据中
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 错误状态
  if (isError) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Card className="border border-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <XCircleIcon className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2">搜索出错</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {error || "搜索时发生未知错误，请稍后重试"}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => window.location.reload()}
            >
              重新加载
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 根据搜索类型显示不同的内容
  if (searchType === "song" && songs.length > 0) {
    return (
      <SongSearchResults
        songs={songs}
        total={total}
        hasMore={hasMore}
        isLoading={isLoading}
        query={query}
        selectedSongs={selectedSongs}
        onSelectSong={handleSelectSong}
        onSelectAll={handleSelectAll}
        onDownload={handleDownload}
        onBatchDownload={handleBatchDownload}
        onLoadMore={handleLoadMore}
        getSongMaxSize={getSongMaxSize}
        formatFileSize={formatFileSize}
        formatDuration={formatDuration}
        onPlaySong={handlePlaySong}
        onAddToPlaylist={handleAddToPlaylist}
        onPlayAllSongs={handlePlayAllSongs}
        isCurrentSongPlaying={isCurrentSongPlaying}
      />
    );
  }

  if (searchType === "album" && albums.length > 0) {
    return (
      <AlbumSearchResults
        albums={albums}
        total={total}
        hasMore={hasMore}
        isLoading={isLoadingMore}
        query={query}
        onLoadMore={handleLoadMore}
        formatPlayCount={formatPlayCount}
      />
    );
  }

  if (searchType === "playlist" && playlists.length > 0) {
    return (
      <PlaylistSearchResults
        playlists={playlists}
        total={total}
        hasMore={hasMore}
        isLoading={isLoadingMore}
        query={query}
        onLoadMore={handleLoadMore}
        formatPlayCount={formatPlayCount}
      />
    );
  }

  // 无结果状态
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border border-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <XCircleIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">未找到相关结果</h3>
          <p className="text-muted-foreground text-center max-w-md">
            没有找到与 &quot;{query}&quot; 相关的
            {type === "song" ? "歌曲" : type === "album" ? "专辑" : "歌单"}
            ，请尝试其他关键词
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => window.history.back()}
          >
            <ChevronRightIcon className="h-4 w-4 mr-2 rotate-180" />
            返回
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// 歌曲搜索结果组件
function SongSearchResults({
  songs,
  total,
  hasMore,
  isLoading,
  query,
  selectedSongs,
  onSelectSong,
  onSelectAll,
  onDownload,
  onBatchDownload,
  onLoadMore,
  getSongMaxSize,
  formatFileSize,
  formatDuration,
  onPlaySong,
  onAddToPlaylist,
  onPlayAllSongs,
  isCurrentSongPlaying,
}: {
  songs: Song[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  query: string;
  selectedSongs: string[];
  onSelectSong: (songId: string) => void;
  onSelectAll: () => void;
  onDownload: (song: Song, quality?: AudioQuality) => void;
  onBatchDownload: () => void;
  onLoadMore: () => void;
  getSongMaxSize: (song: Song) => number;
  formatFileSize: (bytes: number) => string;
  formatDuration: (seconds: number) => string;
  onPlaySong: (song: Song) => void;
  onAddToPlaylist: () => void;
  onPlayAllSongs: () => void;
  isCurrentSongPlaying: (song: Song) => boolean;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border border-muted/30 shadow-sm">
        <CardHeader className="px-6 py-4 border-b bg-muted/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl">搜索结果</CardTitle>
              <CardDescription>
                找到 {total} 项与 &quot;{query}&quot; 相关的歌曲
                {songs.length < total && `，显示前${songs.length}项`}
              </CardDescription>
            </div>
            {songs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={onPlayAllSongs}
                  className="transition-all duration-300 hover:scale-105"
                >
                  <PlayIcon className="mr-2 h-4 w-4" />
                  播放全部
                </Button>
                <Button
                  variant="outline"
                  onClick={onAddToPlaylist}
                  disabled={selectedSongs.length === 0}
                  className="transition-all duration-300 hover:scale-105"
                >
                  <ListMusic className="mr-2 h-4 w-4" />
                  添加到播放列表 ({selectedSongs.length})
                </Button>
                <Button
                  variant="default"
                  onClick={onBatchDownload}
                  disabled={selectedSongs.length === 0}
                  className="transition-all duration-300 hover:scale-105"
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  批量下载 ({selectedSongs.length})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <div className="max-w-full">
          <div className="overflow-x-auto border-b">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={
                        selectedSongs.length === songs.length &&
                        songs.length > 0
                      }
                      onCheckedChange={onSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-12 text-center"></TableHead>
                  <TableHead className="w-[30%]">歌曲</TableHead>
                  <TableHead className="w-[20%]">歌手</TableHead>
                  <TableHead className="w-[15%]">专辑</TableHead>
                  <TableHead className="w-16 text-center">时长</TableHead>
                  <TableHead className="w-16 text-center">大小</TableHead>
                  <TableHead className="w-20 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songs.map((song) => (
                  <TableRow
                    key={song.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedSongs.includes(song.id)}
                        onCheckedChange={() => onSelectSong(song.id)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="w-10 h-10 relative overflow-hidden rounded-lg flex-shrink-0 mx-auto">
                        {song.album.cover ? (
                          <img
                            src={song.album.cover}
                            alt={song.album.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // 如果封面加载失败，显示音乐图标
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const fallback =
                                target.nextElementSibling as HTMLDivElement;
                              if (fallback) {
                                fallback.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-full h-full bg-muted flex items-center justify-center ${
                            song.album.cover ? "hidden" : "flex"
                          }`}
                          style={{
                            display: song.album.cover ? "none" : "flex",
                          }}
                        >
                          <Music className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium leading-none hover:text-primary cursor-pointer transition-colors">
                          {song.name}
                        </p>
                        <div className="flex gap-1">
                          {song.vip && (
                            <Badge variant="secondary" className="text-xs">
                              VIP
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {song.singer.map((singer, index) => (
                          <span key={singer.id}>
                            <span className="text-sm hover:text-primary cursor-pointer transition-colors">
                              {singer.name}
                            </span>
                            {index < song.singer.length - 1 && (
                              <span className="text-muted-foreground mx-1">
                                /
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">
                        {song.album.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(song.duration)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(getSongMaxSize(song))}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Button
                          size="sm"
                          variant={
                            isCurrentSongPlaying(song) ? "default" : "ghost"
                          }
                          onClick={() => {
                            if (isCurrentSongPlaying(song)) {
                              // 如果当前歌曲正在播放，则暂停/播放
                              const { togglePlay } = usePlayerStore.getState();
                              togglePlay();
                            } else {
                              // 播放这首歌
                              onPlaySong(song);
                            }
                          }}
                          className="transition-all duration-300 hover:scale-105"
                        >
                          {isCurrentSongPlaying(song) ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <PlayIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onDownload(song)}
                          className="transition-all duration-300 hover:scale-105"
                        >
                          <DownloadIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 px-6 py-4 border-t bg-muted/20">
            <div className="text-sm text-muted-foreground">
              共 {total} 首歌曲，当前显示 {songs.length} 首
            </div>
            <div className="flex flex-wrap gap-2">
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <LoaderIcon className="h-3.5 w-3.5 mr-2 animate-spin" />
                      加载更多
                    </>
                  ) : (
                    "加载更多"
                  )}
                </Button>
              )}
              {songs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {}}
                  disabled={selectedSongs.length === 0}
                >
                  清除选择
                </Button>
              )}
            </div>
          </CardFooter>
        </div>
      </Card>
    </div>
  );
}

// 专辑搜索结果组件
function AlbumSearchResults({
  albums,
  total,
  hasMore,
  isLoading,
  query,
  onLoadMore,
  formatPlayCount,
}: {
  albums: AlbumSearchItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  query: string;
  onLoadMore: () => void;
  formatPlayCount: (count: number) => string;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border border-muted/30 shadow-sm">
        <CardHeader className="px-6 py-4 border-b bg-muted/50">
          <div className="space-y-1">
            <CardTitle className="text-xl">专辑搜索结果</CardTitle>
            <CardDescription>
              找到 {total} 个与 &quot;{query}&quot; 相关的专辑
              {albums.length < total && `，显示前${albums.length}个`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/album/${album.mid}${
                  album.picUrl ||
                  album.releaseTime ||
                  (album.singers && album.singers.length > 0)
                    ? `?${new URLSearchParams({
                        ...(album.picUrl && { cover: album.picUrl }),
                        ...(album.releaseTime && {
                          releaseTime: album.releaseTime,
                        }),
                        ...(album.singers &&
                          album.singers.length > 0 && {
                            singers: JSON.stringify(album.singers),
                          }),
                      }).toString()}`
                    : ""
                }`}
                className="group cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 block"
              >
                <div className="aspect-square relative overflow-hidden rounded-t-lg">
                  {album.picUrl ? (
                    <img
                      src={album.picUrl}
                      alt={album.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Music className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <PlayIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {album.name}
                  </h3>
                  <div className="space-y-1">
                    {album.singers && album.singers.length > 0 && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <User className="h-3 w-3 inline mr-1" />
                        {album.singers.map((s) => s.name).join(", ")}
                      </p>
                    )}
                    {album.releaseTime && (
                      <p className="text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3 inline mr-1" />
                        {album.releaseTime}
                      </p>
                    )}
                    {album.songCount && album.songCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <Music className="h-3 w-3 inline mr-1" />
                        {album.songCount} 首歌曲
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
        {hasMore && (
          <CardFooter className="flex justify-center border-t bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoaderIcon className="h-3.5 w-3.5 mr-2 animate-spin" />
                  加载更多专辑
                </>
              ) : (
                "加载更多专辑"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

// 歌单搜索结果组件
function PlaylistSearchResults({
  playlists,
  total,
  hasMore,
  isLoading,
  query,
  onLoadMore,
  formatPlayCount,
}: {
  playlists: PlaylistSearchItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  query: string;
  onLoadMore: () => void;
  formatPlayCount: (count: number) => string;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border border-muted/30 shadow-sm">
        <CardHeader className="px-6 py-4 border-b bg-muted/50">
          <div className="space-y-1">
            <CardTitle className="text-xl">歌单搜索结果</CardTitle>
            <CardDescription>
              找到 {total} 个与 &quot;{query}&quot; 相关的歌单
              {playlists.length < total && `，显示前${playlists.length}个`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlist/${playlist.id}`}
                className="group cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] block"
              >
                <div className="flex gap-4 p-4">
                  <div className="w-16 h-16 relative overflow-hidden rounded-lg flex-shrink-0">
                    {playlist.picUrl ? (
                      <img
                        src={playlist.picUrl}
                        alt={playlist.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {playlist.name}
                    </h3>
                    {playlist.desc && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {playlist.desc}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {playlist.creator && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {playlist.creator.name}
                        </span>
                      )}
                      {playlist.songCount && playlist.songCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Music className="h-3 w-3" />
                          {playlist.songCount} 首
                        </span>
                      )}
                      {playlist.playCount && playlist.playCount > 0 && (
                        <span className="flex items-center gap-1">
                          <PlayIcon className="h-3 w-3" />
                          {formatPlayCount(playlist.playCount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
        {hasMore && (
          <CardFooter className="flex justify-center border-t bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoaderIcon className="h-3.5 w-3.5 mr-2 animate-spin" />
                  加载更多歌单
                </>
              ) : (
                "加载更多歌单"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
