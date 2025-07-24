"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Song, AlbumDetail, AudioQuality } from "@/lib/api/types";
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
import { usePlayerStore } from "@/lib/store/player";
import type { Song as PlayerSong } from "@/lib/types/music";
import musicApi from "@/lib/api/client";
import { getQualityDisplayName, formatFileSize } from "@/lib/utils/format";
import RemoteImage from "@/components/ui/remote-image";

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addTask } = useDownloadStore();
  const { defaultQuality } = useSettingsStore();

  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  const albumMid = params.mid as string;
  const coverFromUrl = searchParams.get("cover"); // 从URL参数获取封面
  const releaseTimeFromUrl = searchParams.get("releaseTime"); // 从URL参数获取发布时间
  const singersFromUrl = searchParams.get("singers"); // 从URL参数获取歌手信息

  // 解析歌手信息
  let parsedSingers: any[] = [];
  if (singersFromUrl) {
    try {
      parsedSingers = JSON.parse(singersFromUrl);
    } catch (e) {
      console.warn("解析歌手信息失败:", e);
    }
  }

  // 加载专辑详情
  useEffect(() => {
    async function loadAlbumDetail() {
      if (!albumMid) return;

      setIsLoading(true);
      setIsError(false);
      setError(null);

      try {
        console.log(`[专辑详情] 开始加载专辑: ${albumMid}`);
        const response = await musicApi.getAlbum({ mid: albumMid });

        if (response.code !== 0) {
          throw new Error(response.message || "获取专辑详情失败");
        }

        console.log(`[专辑详情] 成功加载专辑:`, response.data);

        // 直接使用返回的AlbumDetail数据
        setAlbum(response.data);
      } catch (error) {
        console.error("[专辑详情] 加载失败:", error);
        setIsError(true);
        setError(error instanceof Error ? error.message : "未知错误");
        toast.error(
          `加载专辑详情失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadAlbumDetail();
  }, [albumMid]);

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
    if (!album?.songs) return;

    if (selectedSongs.length === album.songs.length) {
      setSelectedSongs([]);
    } else {
      setSelectedSongs(album.songs.map((song) => song.id));
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
    if (!album?.songs || selectedSongs.length === 0) {
      toast.error("请先选择要下载的歌曲");
      return;
    }

    try {
      const selectedSongsData = album.songs.filter((song) =>
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

  // 播放器状态管理
  const playSong = usePlayerStore((s) => s.playSong);
  const playSongList = usePlayerStore((s) => s.playSongList);
  const addToPlaylist = usePlayerStore((s) => s.addToPlaylist);
  const addMultipleToPlaylist = usePlayerStore((s) => s.addMultipleToPlaylist);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  // 转换专辑歌曲为播放器歌曲格式
  function convertToPlayerSong(song: Song): PlayerSong {
    return {
      id: song.mid,
      mid: song.mid,
      title: song.name,
      artist: song.singer.map((s) => s.name).join(", "),
      album: song.album.name,
      cover: song.album.cover || coverFromUrl || undefined,
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

  // 播放整个专辑
  async function handlePlayAllSongs() {
    if (!album?.songs || album.songs.length === 0) {
      toast.error("没有可播放的歌曲");
      return;
    }

    const loadingToast = toast.loading(`正在加载专辑播放列表...`);

    try {
      const playerSongs = album.songs.map(convertToPlayerSong);
      await playSongList(playerSongs, 0);

      toast.dismiss(loadingToast);
      toast.success(
        `开始播放专辑《${album.name}》，共${album.songs.length}首歌曲`
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

    if (!album?.songs) return;

    try {
      const selectedSongsData = album.songs.filter((song) =>
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
                <BreadcrumbPage>专辑详情</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Card className="border border-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <LoaderIcon className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">正在加载专辑详情...</p>
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
                <BreadcrumbPage>专辑详情</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Card className="border border-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <XCircleIcon className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-xl font-semibold mb-2">加载专辑详情失败</h3>
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

  // 没有专辑数据
  if (!album) {
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
              <BreadcrumbPage>专辑详情</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 返回按钮 */}
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>

        {/* 专辑信息 */}
        <Card className="border border-muted/30 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* 专辑封面 */}
              <div className="w-full md:w-48 h-48 flex-shrink-0 relative">
                {coverFromUrl || album.cover ? (
                  <RemoteImage
                    src={coverFromUrl || album.cover || ""}
                    alt={album.name}
                    className="rounded-lg shadow-lg"
                  />
                ) : null}
                <div
                  className={`w-full h-full bg-muted rounded-lg flex items-center justify-center ${
                    coverFromUrl || album.cover ? "hidden" : "flex"
                  }`}
                  style={{
                    display: coverFromUrl || album.cover ? "none" : "flex",
                  }}
                >
                  <Music className="h-16 w-16 text-muted-foreground" />
                </div>
              </div>

              {/* 专辑信息 */}
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{album.name}</h1>
                  {(parsedSingers.length > 0 ||
                    (album.songs &&
                      album.songs.length > 0 &&
                      album.songs[0]?.singer)) && (
                    <p className="text-xl text-muted-foreground flex items-center gap-2">
                      <UserIcon className="h-5 w-5" />
                      {parsedSingers.length > 0
                        ? parsedSingers.map((s) => s.name).join(", ")
                        : album.songs?.[0]?.singer
                            ?.map((s) => s.name)
                            .join(", ") || ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {(releaseTimeFromUrl || album.releaseTime) && (
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>
                        发行时间: {releaseTimeFromUrl || album.releaseTime}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Music className="h-4 w-4" />
                    <span>歌曲数量: {album.songCount} 首</span>
                  </div>
                </div>

                {album.description && (
                  <p className="text-muted-foreground">{album.description}</p>
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
                <CardTitle className="text-xl">专辑歌曲</CardTitle>
                <CardDescription>共 {album.songCount} 首歌曲</CardDescription>
              </div>
              {album.songs && album.songs.length > 0 && (
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

          {album.songs && album.songs.length > 0 ? (
            <div className="max-w-full">
              <div className="overflow-x-auto border-b">
                <Table className="w-full md:table-fixed">
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-10 text-center">
                        <Checkbox
                          checked={
                            selectedSongs.length === album.songs.length &&
                            album.songs.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                      <TableHead className="md:w-[30%]">歌曲</TableHead>
                      <TableHead className="md:w-[20%]">歌手</TableHead>
                      <TableHead className="md:w-[15%]">专辑</TableHead>
                      <TableHead className="w-16 text-center">时长</TableHead>
                      <TableHead className="w-16 text-center">大小</TableHead>
                      <TableHead className="w-20 text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {album.songs.map((song, index) => (
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
                              <img
                                src={song.album.cover}
                                alt={song.album.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // 如果封面加载失败，显示序号
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
                              <span className="text-sm font-medium">
                                {index + 1}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium leading-none">
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
                          <div className="truncate">
                            {song.singer.map((singer, index) => (
                              <span key={singer.id}>
                                <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">
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
                          <span className="text-sm text-muted-foreground">
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
            </div>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Music className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">此专辑暂无歌曲</p>
              <p className="text-muted-foreground">可能是数据还未加载完成</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
