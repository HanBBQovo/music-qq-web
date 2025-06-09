"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MusicIcon,
  DownloadIcon,
  ListMusicIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  LoaderIcon,
  CheckIcon,
  XIcon,
  PlayIcon,
  Pause,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useDownloadStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/store";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import type { Song as PlayerSong } from "@/lib/types/music";

interface ParseResultData {
  success: boolean;
  type?: "song" | "album" | "playlist";
  id?: string;
  mid?: string;
  error?: string;
  playlistData?: {
    name: string;
    songs: string[];
    songCount: number;
  };
}

interface ParseResultContentProps {
  parseId: string;
}

interface DownloadStatus {
  [index: number]: "idle" | "searching" | "downloading" | "success" | "failed";
}

export function ParseResultContent({ parseId }: ParseResultContentProps) {
  const [parseData, setParseData] = useState<ParseResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({});
  const [isDownloading, setIsDownloading] = useState(false);

  // 获取用户设置的默认音质
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

  useEffect(() => {
    // 从localStorage获取解析数据
    const loadParseData = () => {
      try {
        const stored = localStorage.getItem(`parse_result_${parseId}`);
        if (stored) {
          const data = JSON.parse(stored);
          setParseData(data);
        } else {
          setError("解析结果已过期或不存在");
        }
      } catch (err) {
        setError("读取解析结果失败");
      } finally {
        setLoading(false);
      }
    };

    loadParseData();
  }, [parseId]);

  const handleSelectAll = () => {
    if (!parseData?.playlistData) return;

    const allIndexes = Array.from(
      { length: parseData.playlistData.songs.length },
      (_, i) => i
    );
    if (selectedSongs.size === parseData.playlistData.songs.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(allIndexes));
    }
  };

  const handleSelectSong = (index: number) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSongs(newSelected);
  };

  const searchSong = async (songName: string, artistName: string) => {
    try {
      const query = artistName ? `${songName} ${artistName}` : songName;
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
        }/api/search?key=${encodeURIComponent(
          query
        )}&type=song&page=1&pageSize=1`
      );

      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`);
      }

      const result = await response.json();

      if (
        result.code === 0 &&
        result.data.songs &&
        result.data.songs.length > 0
      ) {
        return result.data.songs[0];
      } else {
        throw new Error("未找到匹配的歌曲");
      }
    } catch (error: any) {
      console.error("搜索歌曲失败:", error);
      throw error;
    }
  };

  const downloadSong = async (songInfo: any) => {
    try {
      // 使用现有的下载系统
      const { addTask } = useDownloadStore.getState();

      // 转换为Song格式
      const song = {
        id: songInfo.id || 0,
        mid: songInfo.mid || "",
        name: songInfo.name || "",
        singer: songInfo.singer || [],
        album: songInfo.album || { id: 0, mid: "", name: "", cover: "" },
        duration: songInfo.duration || 0,
        vip: songInfo.vip || false,
        pay: songInfo.pay || { pay_play: 0, pay_download: 0 },
        size: songInfo.size || {},
      };

      // 使用用户设置的默认音质
      await addTask(song, defaultQuality);

      return true;
    } catch (error: any) {
      console.error("添加下载任务失败:", error);
      throw error;
    }
  };

  // 转换歌曲为播放器格式
  const convertToPlayerSong = (
    songInfo: any,
    songName: string,
    artistName: string
  ): PlayerSong => {
    return {
      id: songInfo.mid || songInfo.id,
      mid: songInfo.mid || "",
      title: songName,
      artist: artistName,
      album: songInfo.album?.name || "",
      cover: songInfo.album?.cover || undefined,
      duration: songInfo.duration || 0,
      url: undefined,
      source: "qq-music",
    };
  };

  // 播放单首歌曲
  const handlePlaySong = async (index: number) => {
    if (!parseData?.playlistData) return;

    const song = parseData.playlistData.songs[index];
    const parts = song.split(" - ");
    const songName = parts[0]?.trim() || song;
    const artistName = parts[1]?.trim() || "";

    try {
      toast.loading(`正在搜索《${songName}》...`);

      // 先搜索歌曲
      const songInfo = await searchSong(songName, artistName);
      const playerSong = convertToPlayerSong(songInfo, songName, artistName);

      // 播放歌曲
      const loadingToast = toast.loading(`正在加载《${songName}》...`);
      await playSong(playerSong);

      toast.dismiss(loadingToast);
      toast.success(`开始播放《${songName}》`, {
        description: `歌手: ${artistName}`,
      });
    } catch (error) {
      toast.error(`播放失败: ${(error as Error).message}`);
    }
  };

  // 播放全部歌曲
  const handlePlayAllSongs = async () => {
    if (!parseData?.playlistData || parseData.playlistData.songs.length === 0) {
      toast.error("没有可播放的歌曲");
      return;
    }

    try {
      const loadingToast = toast.loading(`正在准备播放列表...`);
      const playerSongs: PlayerSong[] = [];

      // 搜索前几首歌曲作为播放列表
      const songsToSearch = parseData.playlistData.songs.slice(0, 10); // 限制前10首避免过长等待

      for (const song of songsToSearch) {
        try {
          const parts = song.split(" - ");
          const songName = parts[0]?.trim() || song;
          const artistName = parts[1]?.trim() || "";

          const songInfo = await searchSong(songName, artistName);
          const playerSong = convertToPlayerSong(
            songInfo,
            songName,
            artistName
          );
          playerSongs.push(playerSong);
        } catch (error) {
          console.warn(`跳过无法搜索的歌曲: ${song}`);
        }
      }

      if (playerSongs.length === 0) {
        toast.dismiss(loadingToast);
        toast.error("没有找到可播放的歌曲");
        return;
      }

      await playSongList(playerSongs, 0);

      toast.dismiss(loadingToast);
      toast.success(`开始播放解析歌单，共加载${playerSongs.length}首歌曲`);
    } catch (error) {
      toast.error(`播放失败: ${(error as Error).message}`);
    }
  };

  // 检查当前歌曲是否正在播放
  const isCurrentSongPlaying = (index: number): boolean => {
    if (!parseData?.playlistData) return false;

    const song = parseData.playlistData.songs[index];
    const parts = song.split(" - ");
    const songName = parts[0]?.trim() || song;

    return currentSong?.title === songName && isPlaying;
  };

  const handleDownloadSelected = async () => {
    if (selectedSongs.size === 0) {
      toast.warning("请先选择要下载的歌曲");
      return;
    }

    if (!parseData?.playlistData) return;

    setIsDownloading(true);
    const selectedArray = Array.from(selectedSongs);
    let successCount = 0;
    let failedCount = 0;

    for (const index of selectedArray) {
      const song = parseData.playlistData.songs[index];
      const parts = song.split(" - ");
      const songName = parts[0]?.trim() || song;
      const artistName = parts[1]?.trim() || "";

      setDownloadStatus((prev) => ({ ...prev, [index]: "searching" }));

      try {
        // 1. 搜索歌曲
        const songInfo = await searchSong(songName, artistName);

        setDownloadStatus((prev) => ({ ...prev, [index]: "downloading" }));

        // 2. 添加到下载队列
        await downloadSong(songInfo);

        setDownloadStatus((prev) => ({ ...prev, [index]: "success" }));
        successCount++;

        // 添加延迟避免请求过于频繁
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error: any) {
        setDownloadStatus((prev) => ({ ...prev, [index]: "failed" }));
        failedCount++;
      }
    }

    setIsDownloading(false);
    toast.success(
      `批量下载完成！成功添加: ${successCount}首，失败: ${failedCount}首`
    );
  };

  const handleDownloadSong = async (index: number) => {
    if (!parseData?.playlistData) return;

    const song = parseData.playlistData.songs[index];
    const parts = song.split(" - ");
    const songName = parts[0]?.trim() || song;
    const artistName = parts[1]?.trim() || "";

    setDownloadStatus((prev) => ({ ...prev, [index]: "searching" }));

    try {
      // 1. 搜索歌曲
      const songInfo = await searchSong(songName, artistName);

      setDownloadStatus((prev) => ({ ...prev, [index]: "downloading" }));

      // 2. 添加到下载队列
      await downloadSong(songInfo);

      setDownloadStatus((prev) => ({ ...prev, [index]: "success" }));
      toast.success(`已添加到下载队列: ${songName}`);
    } catch (error: any) {
      setDownloadStatus((prev) => ({ ...prev, [index]: "failed" }));
      toast.error(`添加失败: ${songName} - ${error.message}`);
    }
  };

  const getQualityDisplayName = (quality: string): string => {
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
  };

  // 渲染歌曲状态
  const renderSongStatus = (status: string) => {
    switch (status) {
      case "searching":
        return (
          <div className="flex items-center gap-1 text-blue-600">
            <LoaderIcon className="h-3 w-3 animate-spin flex-shrink-0" />
            <span className="text-xs truncate">正在搜索...</span>
          </div>
        );
      case "downloading":
        return (
          <div className="flex items-center gap-1 text-orange-600">
            <LoaderIcon className="h-3 w-3 animate-spin flex-shrink-0" />
            <span className="text-xs truncate">正在下载...</span>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-1 text-green-600">
            <CheckIcon className="h-3 w-3 flex-shrink-0" />
            <span className="text-xs truncate">下载完成</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-1 text-red-600">
            <XIcon className="h-3 w-3 flex-shrink-0" />
            <span className="text-xs truncate">下载失败</span>
          </div>
        );
      default:
        return null;
    }
  };

  // 渲染操作按钮
  const renderActionButtons = (status: string, index: number) => {
    const isProcessing = status === "searching" || status === "downloading";

    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={isCurrentSongPlaying(index) ? "default" : "ghost"}
          onClick={() => {
            if (isCurrentSongPlaying(index)) {
              togglePlay();
            } else {
              handlePlaySong(index);
            }
          }}
          className="transition-all duration-300 hover:scale-105"
        >
          {isCurrentSongPlaying(index) ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <PlayIcon className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          size="sm"
          onClick={() => handleDownloadSong(index)}
          disabled={isProcessing}
          className="transition-all duration-300 hover:scale-105"
        >
          {status === "searching" || status === "downloading" ? (
            <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
          ) : status === "success" ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <DownloadIcon className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">正在加载解析结果...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !parseData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertTriangleIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">加载失败</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              重新加载
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!parseData.success || !parseData.playlistData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertTriangleIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">解析结果无效</h3>
            <p className="text-muted-foreground">
              {parseData.error || "未找到有效的歌单数据"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { playlistData } = parseData;

  return (
    <div className="space-y-6">
      {/* 歌单信息卡片 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-purple-500/10 text-purple-500"
                >
                  <ListMusicIcon className="h-3.5 w-3.5 mr-1" />
                  解析歌单
                </Badge>
                <Badge variant="outline">{playlistData.songCount} 首歌曲</Badge>
                {selectedSongs.size > 0 && (
                  <Badge variant="default">
                    已选择 {selectedSongs.size} 首
                  </Badge>
                )}
                <Badge variant="secondary">
                  音质: {getQualityDisplayName(defaultQuality)}
                </Badge>
              </div>
              <CardTitle className="text-xl lg:text-2xl">
                {playlistData.name}
              </CardTitle>
              <p className="text-muted-foreground">
                通过链接解析获得 • 共 {playlistData.songCount} 首歌曲
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={handlePlayAllSongs}
                className="w-full lg:w-auto shrink-0"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                播放全部
              </Button>
              <Button
                onClick={handleDownloadSelected}
                disabled={selectedSongs.size === 0 || isDownloading}
                className="w-full lg:w-auto shrink-0"
              >
                {isDownloading ? (
                  <>
                    <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                    下载中...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="h-4 w-4 mr-2" />
                    下载选中 ({selectedSongs.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 下载说明 */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-orange-800">下载说明</p>
              <p className="text-sm text-orange-700">
                解析出的歌曲会通过搜索匹配QQ音乐库中的歌曲进行下载。选择要下载的歌曲后点击"下载选中"按钮即可开始批量下载。下载音质为：
                {getQualityDisplayName(defaultQuality)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 歌曲列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MusicIcon className="h-5 w-5" />
            歌曲列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 桌面端表格视图 */}
          <div className="hidden lg:block">
            <div className="w-full border-b">
              <Table className="table-fixed w-full">
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={
                          selectedSongs.size === playlistData.songs.length &&
                          playlistData.songs.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                    <TableHead className="w-[50%]">歌曲信息</TableHead>
                    <TableHead className="w-24 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playlistData.songs.map((song, index) => {
                    // 解析歌曲信息：歌曲名 - 歌手名
                    const parts = song.split(" - ");
                    const songName = parts[0]?.trim() || song;
                    const artistName = parts[1]?.trim() || "";
                    const status = downloadStatus[index] || "idle";

                    return (
                      <TableRow
                        key={index}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedSongs.has(index)}
                            onCheckedChange={() => handleSelectSong(index)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="w-10 h-10 relative overflow-hidden rounded-lg flex-shrink-0 mx-auto">
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <span className="text-sm font-medium text-muted-foreground">
                                {index + 1}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <div className="space-y-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="font-medium leading-none truncate">
                                    {songName}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{songName}</p>
                                </TooltipContent>
                              </Tooltip>
                              {artistName && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="text-sm text-muted-foreground truncate">
                                      {artistName}
                                    </p>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{artistName}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {status !== "idle" && renderSongStatus(status)}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center">
                          {renderActionButtons(status, index)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 移动端卡片视图 */}
          <div className="lg:hidden space-y-3 p-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    selectedSongs.size === playlistData.songs.length &&
                    playlistData.songs.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  全选 ({selectedSongs.size}/{playlistData.songs.length})
                </span>
              </div>
            </div>

            {playlistData.songs.map((song, index) => {
              // 解析歌曲信息：歌曲名 - 歌手名
              const parts = song.split(" - ");
              const songName = parts[0]?.trim() || song;
              const artistName = parts[1]?.trim() || "";
              const status = downloadStatus[index] || "idle";

              return (
                <Card
                  key={index}
                  className="p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedSongs.has(index)}
                      onCheckedChange={() => handleSelectSong(index)}
                      className="mt-1"
                    />
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm leading-tight">
                        {songName}
                      </p>
                      {artistName && (
                        <p className="text-xs text-muted-foreground">
                          {artistName}
                        </p>
                      )}
                      {status !== "idle" && renderSongStatus(status)}
                    </div>
                    <div className="flex-shrink-0">
                      {renderActionButtons(status, index)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
