"use client";

import { useState } from "react";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Music, MoreVertical, Trash2, ListX, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

// 格式化时间显示
const formatTime = (seconds: number = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface PlaylistPanelProps {
  className?: string;
}

// 歌曲项组件
interface SongItemProps {
  song: any;
  index: number;
  isCurrentSong: boolean;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
}

function SongItem({
  song,
  index,
  isCurrentSong,
  onPlay,
  onRemove,
}: SongItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors group rounded-lg",
        isCurrentSong && "bg-primary/10 border-l-2 border-l-primary"
      )}
    >
      {/* 专辑封面 */}
      <div className="w-10 h-10 bg-muted rounded-md overflow-hidden flex-shrink-0">
        {song.cover ? (
          <img
            src={song.cover}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Music className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 歌曲信息 */}
      <div className="min-w-0 flex-1" onClick={() => onPlay(index)}>
        <p
          className={cn(
            "text-sm font-medium truncate cursor-pointer",
            isCurrentSong && "text-primary"
          )}
        >
          {song.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>

      {/* 时长 */}
      <div className="text-xs text-muted-foreground tabular-nums">
        {formatTime(song.duration)}
      </div>

      {/* 播放按钮和菜单 */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPlay(index)}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {isCurrentSong ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPlay(index)}>
              <Play className="h-4 w-4 mr-2" />
              播放
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(index)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              从列表中移除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function PlaylistPanel() {
  const {
    playlist,
    currentSong,
    isPlaying,
    showPlaylist,
    setShowPlaylist,
    playAtIndex,
    removeFromPlaylist,
    clearPlaylist,
    togglePlay,
  } = usePlayerStore();

  const [showClearDialog, setShowClearDialog] = useState(false);

  // 播放指定歌曲
  const handlePlaySong = (index: number) => {
    if (currentSong && playlist[index]?.id === currentSong.id && isPlaying) {
      togglePlay();
    } else {
      playAtIndex(index);
    }
  };

  // 移除歌曲
  const handleRemoveSong = (index: number) => {
    removeFromPlaylist(index);
  };

  // 清空播放列表
  const handleClearPlaylist = () => {
    clearPlaylist();
    setShowClearDialog(false);
  };

  return (
    <>
      <Sheet open={showPlaylist} onOpenChange={setShowPlaylist}>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>播放列表</SheetTitle>
            <SheetDescription>
              当前播放队列，共 {playlist.length} 首歌曲
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            {playlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Music className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">播放列表为空</h3>
                <p className="text-sm text-muted-foreground">
                  从搜索结果中添加歌曲到播放列表
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* 操作按钮 */}
                <div className="px-6 py-3 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                    className="w-full"
                    disabled={playlist.length === 0}
                  >
                    <ListX className="h-4 w-4 mr-2" />
                    清空列表
                  </Button>
                </div>

                {/* 歌曲列表 */}
                <ScrollArea className="flex-1">
                  <div className="px-3 py-2 space-y-1">
                    {playlist.map((song, index) => (
                      <SongItem
                        key={song.id || `${song.title}-${index}`}
                        song={song}
                        index={index}
                        isCurrentSong={currentSong?.id === song.id}
                        onPlay={handlePlaySong}
                        onRemove={handleRemoveSong}
                      />
                    ))}
                  </div>
                </ScrollArea>

                {/* 底部统计信息 */}
                <div className="px-6 py-3 border-t bg-muted/30">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>共 {playlist.length} 首歌曲</span>
                    <span>
                      总时长{" "}
                      {formatTime(
                        playlist.reduce(
                          (total, song) => total + (song.duration || 0),
                          0
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 清空确认对话框 */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空播放列表</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空播放列表吗？此操作不可撤销，将移除所有 {playlist.length}{" "}
              首歌曲。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPlaylist}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
