"use client";

import { useState } from "react";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useDownloadStore } from "@/lib/store/useDownloadStore";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import {
  Music,
  MoreVertical,
  Trash2,
  ListX,
  Play,
  Pause,
  Clock,
  Disc3,
  Download,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudioQuality } from "@/lib/api/types";

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
  onDownload: (index: number) => void;
  isDeleting?: boolean;
}

// 可拖拽的歌曲项组件
interface SortableSongItemProps extends SongItemProps {
  id: string;
}

function SortableSongItem(props: SortableSongItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50 z-50")}
    >
      <SongItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function SongItem({
  song,
  index,
  isCurrentSong,
  onPlay,
  onRemove,
  onDownload,
  dragHandleProps,
  isDeleting = false,
}: SongItemProps & { dragHandleProps?: any }) {
  const { isPlaying } = usePlayerStore();

  const handleClick = () => {
    if (isDeleting) {
      console.log("🚫 删除期间，阻止歌曲点击");
      return;
    }
    onPlay(index);
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl transition-all duration-300 ease-out",
        "hover:bg-gradient-to-r hover:from-primary/5 hover:to-purple-500/5",
        "hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5",
        "cursor-pointer border border-transparent hover:border-primary/20",
        "w-full overflow-hidden",
        isCurrentSong && [
          "bg-gradient-to-r from-primary/10 to-purple-500/10",
          "border-primary/30 shadow-lg",
          "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1",
          "before:bg-gradient-to-b before:from-primary before:to-purple-500 before:rounded-r-full",
        ],
        isDeleting && [
          "pointer-events-none opacity-75 cursor-not-allowed",
          "hover:scale-100 hover:shadow-none",
        ]
      )}
      onClick={handleClick}
      style={{ width: "100%", maxWidth: "100%" }}
    >
      {/* 使用Grid布局，三列：封面、信息、按钮 */}
      <div
        className="grid gap-2 p-2 w-full items-center"
        style={{
          gridTemplateColumns: "40px 1fr auto",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {/* 第1列：序号和专辑封面 */}
        <div className="relative">
          <div className="w-10 h-10 rounded-lg overflow-hidden shadow-lg ring-1 ring-black/5">
            {song.cover ? (
              <img
                src={song.cover}
                alt={song.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                <Music className="h-4 w-4 text-primary/60" />
              </div>
            )}
          </div>

          {/* 播放状态指示器 */}
          {isCurrentSong && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gradient-to-r from-primary to-purple-500 rounded-full flex items-center justify-center shadow-lg">
              {isPlaying ? (
                <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
              ) : (
                <div className="w-0.5 h-0.5 bg-white rounded-full" />
              )}
            </div>
          )}

          {/* 序号显示 */}
          <div
            className={cn(
              "absolute inset-0 bg-black/40 backdrop-blur-sm rounded-lg",
              "flex items-center justify-center text-white font-medium text-xs",
              "opacity-0 transition-opacity duration-200",
              "group-hover:opacity-100"
            )}
          >
            {index + 1}
          </div>
        </div>

        {/* 第2列：歌曲信息 */}
        <div className="min-w-0 overflow-hidden">
          <h3
            className={cn(
              "font-semibold text-sm leading-tight mb-0.5 truncate transition-colors",
              isCurrentSong
                ? "text-primary"
                : "text-foreground group-hover:text-primary"
            )}
          >
            {song.title}
          </h3>
          <div className="text-xs text-muted-foreground">
            <div className="truncate">{song.artist}</div>
            {song.album && (
              <div className="truncate opacity-75 text-xs">{song.album}</div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="tabular-nums">{formatTime(song.duration)}</span>
            {song.source && (
              <>
                <span>•</span>
                <span className="uppercase text-xs">{song.source}</span>
              </>
            )}
          </div>
        </div>

        {/* 第3列：操作按钮 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* 拖拽手柄 */}
          <div
            {...dragHandleProps}
            className="h-8 w-8 rounded-full hover:bg-muted hover:text-foreground flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-200"
          >
            <GripVertical className="h-3 w-3" />
          </div>

          {/* 播放/暂停按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full hover:bg-primary hover:text-primary-foreground"
            onClick={(e) => {
              e.stopPropagation();
              if (isDeleting) {
                e.preventDefault();
                return false;
              }
              onPlay(index);
            }}
            disabled={isDeleting}
          >
            {isCurrentSong && isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3 ml-0.5" />
            )}
          </Button>

          {/* 更多操作菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDeleting) {
                    e.preventDefault();
                    return false;
                  }
                }}
                disabled={isDeleting}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onPlay(index)}>
                <Play className="h-4 w-4 mr-3" />
                播放歌曲
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (isDeleting) return false;
                  onDownload(index);
                  return false;
                }}
              >
                <Download className="h-4 w-4 mr-3" />
                下载歌曲
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove(index);
                  return false;
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-3" />
                从列表移除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
    moveInPlaylist,
  } = usePlayerStore();

  const { addTask } = useDownloadStore();
  const { defaultQuality } = useSettingsStore();

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 播放指定歌曲
  const handlePlaySong = (index: number) => {
    // 如果正在删除操作中，忽略点击事件
    if (isDeleting) {
      console.log("🚫 正在删除操作中，忽略播放点击");
      return;
    }

    if (currentSong && playlist[index]?.id === currentSong.id && isPlaying) {
      togglePlay();
    } else {
      playAtIndex(index);
    }
  };

  // 移除歌曲
  const handleRemoveSong = (index: number) => {
    console.log("🗑️ 开始删除操作，设置防抖");
    setIsDeleting(true);

    removeFromPlaylist(index);

    // 300ms后解除删除状态，防止意外点击
    setTimeout(() => {
      setIsDeleting(false);
      console.log("✅ 删除操作完成，解除防抖");
    }, 300);
  };

  // 下载歌曲
  const handleDownloadSong = async (index: number) => {
    const song = playlist[index];
    if (!song) return;

    try {
      // 转换为下载系统需要的格式 (lib/api/types.ts 中的 Song)
      const downloadSong: import("@/lib/api/types").Song = {
        id: String(song.id || ""),
        mid: song.mid || "",
        name: song.title || "",
        singer: song.artist ? [{ id: 0, mid: "", name: song.artist }] : [],
        album: {
          id: 0,
          mid: "",
          name: song.album || "",
          cover: song.cover || "",
        },
        duration: song.duration || 0,
        vip: false,
        pay: { pay_play: 0, pay_download: 0 },
        size: {
          size128: 0,
          size320: 0,
          sizeape: 0,
          sizeflac: 0,
        },
      };

      await addTask(downloadSong, defaultQuality);

      toast.success(`已添加《${song.title}》到下载队列`, {
        description: `歌手: ${song.artist}`,
      });
    } catch (error) {
      console.error("下载失败:", error);
      toast.error(`添加下载任务失败: ${(error as Error).message}`);
    }
  };

  // 清空播放列表
  const handleClearPlaylist = () => {
    clearPlaylist();
    setShowClearDialog(false);
  };

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = playlist.findIndex(
        (item, index) => `${item.id || item.title}-${index}` === active.id
      );
      const newIndex = playlist.findIndex(
        (item, index) => `${item.id || item.title}-${index}` === over?.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        moveInPlaylist(oldIndex, newIndex);
      }
    }
  };

  // 计算总时长
  const totalDuration = playlist.reduce(
    (total, song) => total + (song.duration || 0),
    0
  );

  return (
    <>
      <Sheet open={showPlaylist} onOpenChange={setShowPlaylist}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col h-full"
        >
          {/* 头部 - 渐变背景 */}
          <SheetHeader className="px-6 py-6 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary to-purple-500 flex items-center justify-center shadow-lg">
                <Music className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                  播放列表
                </SheetTitle>
                <SheetDescription className="text-sm">
                  当前播放队列 • {playlist.length} 首歌曲
                </SheetDescription>
              </div>
            </div>

            {/* 统计信息卡片 */}
            {playlist.length > 0 && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-white/30 dark:bg-black/15 backdrop-blur-sm border border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-primary">
                      {playlist.length}
                    </span>
                    <span className="text-muted-foreground">首歌曲</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-purple-500">
                      {formatTime(totalDuration)}
                    </span>
                    <span className="text-muted-foreground">总时长</span>
                  </div>
                </div>
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {playlist.length === 0 ? (
              /* 空状态 - 现代化设计 */
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
                  <Music className="h-12 w-12 text-primary/60" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">
                  播放列表为空
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-sm">
                  从搜索结果中添加您喜欢的歌曲
                  <br />
                  开始您的音乐之旅
                </p>
                <div className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20">
                  <p className="text-sm text-primary font-medium">
                    💡 小提示：点击歌曲旁的 ♪ 按钮添加到播放列表
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0">
                {/* 操作工具栏 */}
                <div className="px-6 py-2 border-b border-border/50 bg-muted/30 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                    className={cn(
                      "h-8 px-3 rounded-lg border-dashed text-xs",
                      "hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive",
                      "transition-all duration-200"
                    )}
                    disabled={playlist.length === 0}
                  >
                    <ListX className="h-3 w-3 mr-1.5" />
                    清空列表
                  </Button>
                </div>

                {/* 歌曲列表 */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
                    <div className="p-3 space-y-1 w-full">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={playlist.map(
                            (song, index) => `${song.id || song.title}-${index}`
                          )}
                          strategy={verticalListSortingStrategy}
                        >
                          {playlist.map((song, index) => (
                            <div
                              key={song.id || `${song.title}-${index}`}
                              className="w-full"
                              style={{ maxWidth: "100%", width: "100%" }}
                            >
                              <SortableSongItem
                                song={song}
                                index={index}
                                isCurrentSong={currentSong?.id === song.id}
                                onPlay={handlePlaySong}
                                onRemove={handleRemoveSong}
                                onDownload={handleDownloadSong}
                                id={`${song.id || song.title}-${index}`}
                                isDeleting={isDeleting}
                              />
                            </div>
                          ))}
                        </SortableContext>
                      </DndContext>

                      {/* 底部间距 */}
                      <div className="h-4" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 清空确认对话框 - 现代化设计 */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <ListX className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">
                清空播放列表
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              确定要清空播放列表吗？此操作将移除所有{" "}
              <span className="font-semibold text-destructive">
                {playlist.length}
              </span>{" "}
              首歌曲，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPlaylist}
              className={cn(
                "rounded-xl bg-destructive text-destructive-foreground",
                "hover:bg-destructive/90 transition-all duration-200"
              )}
            >
              清空列表
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
