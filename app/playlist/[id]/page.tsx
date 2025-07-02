"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Song, Playlist, AudioQuality } from "@/lib/api/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import {
  DownloadIcon,
  LoaderIcon,
  XCircleIcon,
  Music,
  CalendarIcon,
  UserIcon,
  ArrowLeft,
  PlayIcon,
  Pause,
  ListMusic,
} from "lucide-react";
import { useDownloadStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/store";
import { useSearchStore } from "@/lib/store";
import musicApi from "@/lib/api/client";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import type { Song as PlayerSong } from "@/lib/types/music";
import { getQualityDisplayName, formatFileSize } from "@/lib/utils/format";
import RemoteImage from "@/components/ui/remote-image";

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addTask } = useDownloadStore();
  const { defaultQuality } = useSettingsStore();
  const { getCachedPlaylistDetail } = useSearchStore();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  const playlistId = params.id as string;

  // 尝试从缓存获取歌单信息
  const cachedPlaylistInfo = getCachedPlaylistDetail(playlistId);

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

  // 加载歌单详情
  useEffect(() => {
    async function loadPlaylistDetail() {
      if (!playlistId) return;

      setIsLoading(true);
      setIsError(false);
      setError(null);

      try {
        console.log(`[歌单详情] 开始加载歌单: ${playlistId}`);

        // 尝试解析为数字，如果失败则使用原始字符串
        let apiPlaylistId: number | string = parseInt(playlistId);
        if (isNaN(apiPlaylistId)) {
          console.log(`[歌单详情] ID不是数字格式，使用字符串: ${playlistId}`);
          apiPlaylistId = playlistId;
        }

        const response = await musicApi.getPlaylist({
          id: apiPlaylistId,
        });

        if (response.code !== 0) {
          throw new Error(response.message || "获取歌单详情失败");
        }

        console.log(`[歌单详情] 成功加载歌单:`, response.data);
        setPlaylist(response.data);
      } catch (error) {
        console.error("[歌单详情] 加载失败:", error);
        setIsError(true);
        setError(error instanceof Error ? error.message : "未知错误");
        toast.error(
          `加载歌单详情失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPlaylistDetail();
  }, [playlistId]);

  // 处理歌曲选择
  function handleSelectSong(songId: string) {
    setSelectedSongs((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  }

  // 处理全选
  function handleSelectAll() {
    if (!playlist?.songlist) return;

    if (selectedSongs.length === playlist.songlist.length) {
      setSelectedSongs([]);
    } else {
      setSelectedSongs(playlist.songlist.map((song) => song.id));
    }
  }

  // 处理单曲下载
  async function handleDownload(song: Song, quality?: AudioQuality) {
    try {
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

  // 处理批量下载
  async function handleBatchDownload() {
    if (!playlist?.songlist || selectedSongs.length === 0) {
      toast.error("请先选择要下载的歌曲");
      return;
    }

    try {
      const selectedSongsData = playlist.songlist.filter((song) =>
        selectedSongs.includes(song.id)
      );

      for (const song of selectedSongsData) {
        await addTask(song, defaultQuality);
      }

      toast.success(`已添加${selectedSongs.length}首歌曲到下载队列`, {
        description: `音质: ${getQualityDisplayName(defaultQuality)}`,
      });

      setSelectedSongs([]);
    } catch (error) {
      toast.error(`批量添加下载任务失败: ${(error as Error).message}`);
    }
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
      return `${(count / 100000000).toFixed(1)}亿`;
    } else if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}万`;
    } else {
      return count.toString();
    }
  }

  // 格式化时间
  function formatTime(time: string | number): string {
    if (!time) return "";
    const date = new Date(typeof time === "string" ? time : time * 1000);
    return date.toLocaleDateString("zh-CN");
  }

  // 获取歌曲最高质量文件大小
  function getSongMaxSize(song: Song): number {
    const sizes = [
      song.size.sizeflac,
      song.size.sizeape,
      song.size.size320,
      song.size.size128,
    ];
    return Math.max(...sizes.filter((size) => size > 0));
  }

  // 转换歌单歌曲为播放器歌曲格式
  function convertToPlayerSong(song: Song): PlayerSong {
    return {
      id: song.mid,
      mid: song.mid,
      title: song.name,
      artist: song.singer.map((s) => s.name).join(", "),
      album: song.album.name,
      cover: song.album.cover || undefined,
      duration: song.duration,
      url: undefined,
      source: "qq-music",
    };
  }

  // 播放单首歌曲
  async function handlePlaySong(song: Song) {
    const loadingToast = toast.loading(`正在加载《${song.name}》...`);

    try {
      const playerSong = convertToPlayerSong(song);
      await playSong(playerSong);

      toast.dismiss(loadingToast);
      toast.success(`开始播放《${song.name}》`, {
        description: `歌手: ${song.singer.map((s) => s.name).join(", ")}`,
      });
    } catch (error) {
      // 关闭加载提示，错误信息由audio-url.ts统一显示
      toast.dismiss(loadingToast);
    }
  }

  // 播放整个歌单
  async function handlePlayAllSongs() {
    if (!playlist?.songlist || playlist.songlist.length === 0) {
      toast.error("没有可播放的歌曲");
      return;
    }

    const loadingToast = toast.loading(`正在加载歌单播放列表...`);

    try {
      const playerSongs = playlist.songlist.map(convertToPlayerSong);
      await playSongList(playerSongs, 0);

      toast.dismiss(loadingToast);
      toast.success(
        `开始播放歌单《${playlist.name}》，共${playlist.songlist.length}首歌曲`
      );
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

    if (!playlist?.songlist) return;

    try {
      const selectedSongsData = playlist.songlist.filter((song) =>
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

  // 检查当前歌曲是否正在播放
  function isCurrentSongPlaying(song: Song): boolean {
    return currentSong?.mid === song.mid && isPlaying;
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className="layout-container">
        <div className="space-y-4 py-6 md:py-8">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">首页</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>歌单详情</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Card className="border border-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <LoaderIcon className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">正在加载歌单详情...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 错误状态
  if (isError) {
    return (
      <div className="layout-container">
        <div className="space-y-4 py-6 md:py-8">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">首页</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>歌单详情</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Card className="border border-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <XCircleIcon className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-xl font-semibold mb-2">加载歌单详情失败</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {error || "加载时发生未知错误，请稍后重试"}
              </p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => router.back()}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Button>
                <Button onClick={() => window.location.reload()}>
                  重新加载
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 没有歌单数据
  if (!playlist) {
    return null;
  }

  return (
    <div className="layout-container">
      <div className="space-y-6 py-6 md:py-8">
        {/* 面包屑导航 */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">首页</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>歌单详情</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 返回按钮 */}
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>

        {/* 歌单信息 */}
        <Card className="border border-muted/30 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* 歌单封面 */}
              <div className="w-full md:w-48 h-48 relative overflow-hidden rounded-lg flex-shrink-0">
                {(cachedPlaylistInfo?.picUrl || playlist.logo) && (
                  <RemoteImage
                    src={cachedPlaylistInfo?.picUrl || playlist.logo || ""}
                    alt={playlist.name}
                  />
                )}
                <div
                  className={`w-full h-full bg-muted flex items-center justify-center ${
                    cachedPlaylistInfo?.picUrl || playlist.logo
                      ? "hidden"
                      : "flex"
                  }`}
                  style={{
                    display:
                      cachedPlaylistInfo?.picUrl || playlist.logo
                        ? "none"
                        : "flex",
                  }}
                >
                  <Music className="h-16 w-16 text-muted-foreground" />
                </div>
              </div>

              {/* 歌单信息 */}
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{playlist.name}</h1>
                  {(cachedPlaylistInfo?.creator?.name ||
                    playlist.creator?.name) && (
                    <p className="text-xl text-muted-foreground flex items-center gap-2">
                      <UserIcon className="h-5 w-5" />
                      {cachedPlaylistInfo?.creator?.name ||
                        playlist.creator?.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Music className="h-4 w-4" />
                    <span>歌曲数量: {playlist.songnum} 首</span>
                  </div>
                  {playlist.create_time && (
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>创建时间: {formatTime(playlist.create_time)}</span>
                    </div>
                  )}
                  {playlist.update_time && (
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>更新时间: {formatTime(playlist.update_time)}</span>
                    </div>
                  )}
                </div>

                {(cachedPlaylistInfo?.desc || playlist.desc) && (
                  <p className="text-muted-foreground">
                    {cachedPlaylistInfo?.desc || playlist.desc}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 歌曲列表 */}
        <Card className="border border-muted/30 shadow-sm">
          <CardHeader className="px-6 py-4 border-b bg-muted/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <CardTitle className="text-xl">歌单歌曲</CardTitle>
                <CardDescription>共 {playlist.songnum} 首歌曲</CardDescription>
              </div>
              {playlist.songlist && playlist.songlist.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={handlePlayAllSongs}
                    className="transition-all duration-300 hover:scale-105"
                  >
                    <PlayIcon className="mr-2 h-4 w-4" />
                    播放全部
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAddToPlaylist}
                    disabled={selectedSongs.length === 0}
                    className="transition-all duration-300 hover:scale-105"
                  >
                    <ListMusic className="mr-2 h-4 w-4" />
                    添加到播放列表 ({selectedSongs.length})
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleBatchDownload}
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

          {playlist.songlist && playlist.songlist.length > 0 ? (
            <div className="w-full">
              {/* 桌面端和平板端表格视图 */}
              <div className="hidden md:block border-b">
                <Table className="table-fixed w-full">
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-10 text-center">
                        <Checkbox
                          checked={
                            selectedSongs.length === playlist.songlist.length &&
                            playlist.songlist.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                      <TableHead className="w-[30%]">歌曲</TableHead>
                      <TableHead className="w-[20%]">歌手</TableHead>
                      <TableHead className="w-[15%] hidden lg:table-cell">
                        专辑
                      </TableHead>
                      <TableHead className="w-16 text-center">时长</TableHead>
                      <TableHead className="w-16 text-center hidden xl:table-cell">
                        大小
                      </TableHead>
                      <TableHead className="w-20 text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playlist.songlist.map((song, index) => (
                      <TableRow
                        key={song.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedSongs.includes(song.id)}
                            onCheckedChange={() => handleSelectSong(song.id)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="w-10 h-10 relative overflow-hidden rounded-lg flex-shrink-0 mx-auto">
                            {song.album.cover ? (
                              <RemoteImage
                                src={song.album.cover || ""}
                                alt={song.album.name}
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
                              <span className="text-sm font-medium">
                                {index + 1}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="font-medium leading-none truncate">
                                  {song.name}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{song.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate text-sm text-muted-foreground">
                                  {song.singer.map((singer, index) => (
                                    <span key={singer.id}>
                                      {singer.name}
                                      {index < song.singer.length - 1 && (
                                        <span className="mx-1">/</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {song.singer.map((s) => s.name).join(" / ")}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground truncate block">
                                  {song.album.name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{song.album.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">
                            {formatDuration(song.duration)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden xl:table-cell">
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
                                  togglePlay();
                                } else {
                                  handlePlaySong(song);
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
                              onClick={() => handleDownload(song)}
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

              {/* 移动端卡片视图 */}
              <div className="md:hidden space-y-3 p-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        selectedSongs.length === playlist.songlist.length &&
                        playlist.songlist.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      全选 ({selectedSongs.length}/{playlist.songlist.length})
                    </span>
                  </div>
                </div>

                {playlist.songlist.map((song, index) => (
                  <Card
                    key={song.id}
                    className="p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedSongs.includes(song.id)}
                        onCheckedChange={() => handleSelectSong(song.id)}
                        className="mt-1"
                      />
                      <div className="flex-shrink-0 w-12 h-12 relative overflow-hidden rounded-lg">
                        {song.album.cover ? (
                          <RemoteImage
                            src={song.album.cover || ""}
                            alt={song.album.name}
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
                          <span className="text-xs font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium text-sm leading-tight truncate">
                          {song.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.singer.map((s) => s.name).join(" / ")}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(song.duration)}
                          </span>
                          {song.vip && (
                            <Badge variant="secondary" className="text-xs">
                              VIP
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={
                              isCurrentSongPlaying(song) ? "default" : "ghost"
                            }
                            onClick={() => {
                              if (isCurrentSongPlaying(song)) {
                                togglePlay();
                              } else {
                                handlePlaySong(song);
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
                            onClick={() => handleDownload(song)}
                            className="transition-all duration-300 hover:scale-105"
                          >
                            <DownloadIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Music className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">此歌单暂无歌曲</p>
              <p className="text-muted-foreground">可能是数据还未加载完成</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
