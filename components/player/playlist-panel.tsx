"use client";

import { useState, memo } from "react";
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
  Download,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RemoteImage from "@/components/ui/remote-image";

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
    transition: isDragging ? undefined : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50 z-50" : undefined}
    >
      <SongItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

const SongItem = memo(
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
    const isPlaying = usePlayerStore((s) => s.isPlaying);

    const handleClick = () => {
      if (isDeleting) {
        return;
      }
      onPlay(index);
    };

    return (
      <div
        className={cn(
          "group relative rounded-lg transition-colors duration-150",
          "hover:bg-muted/50",
          "cursor-pointer border border-transparent",
          "w-full overflow-hidden",
          isCurrentSong && [
            "bg-primary/5 border-primary/20",
            "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1",
            "before:bg-primary before:rounded-r-full",
          ],
          isDeleting && ["pointer-events-none opacity-60 cursor-not-allowed"]
        )}
        onClick={handleClick}
        style={{ width: "100%", maxWidth: "100%" }}
      >
        {/* 使用Grid布局，三列：封面、信息、按钮 */}
        <div
          className="grid gap-3 p-3 w-full items-center"
          style={{
            gridTemplateColumns: "40px 1fr auto",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          {/* 第1列：序号和专辑封面 */}
          <div className="relative">
            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted">
              {song.cover ? (
                <RemoteImage
                  src={song.cover || ""}
                  alt={song.title}
                  className=""
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Music className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* 播放状态指示器 - 简化 */}
            {isCurrentSong && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full">
                {isPlaying && (
                  <div className="w-1 h-1 bg-white rounded-full absolute top-1 left-1" />
                )}
              </div>
            )}
          </div>

          {/* 第2列：歌曲信息 */}
          <div className="min-w-0 overflow-hidden">
            <h3
              className={cn(
                "font-medium text-sm leading-tight mb-1 truncate",
                isCurrentSong ? "text-primary" : "text-foreground"
              )}
            >
              {song.title}
            </h3>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div className="truncate">{song.artist}</div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {formatTime(song.duration)}
                </span>
                {song.source && (
                  <>
                    <span>•</span>
                    <span className="uppercase">{song.source}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 第3列：操作按钮 - 简化 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {/* 拖拽手柄 - 简化 */}
            <div
              {...dragHandleProps}
              className="h-8 w-8 rounded-md hover:bg-muted/70 flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-3 w-3" />
            </div>

            {/* 播放/暂停按钮 - 简化 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-md"
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
                <Play className="h-3 w-3" />
              )}
            </Button>

            {/* 更多操作菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-md"
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
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onPlay(index)}>
                  <Play className="h-4 w-4 mr-2" />
                  播放
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
                  <Download className="h-4 w-4 mr-2" />
                  下载
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
                  <Trash2 className="h-4 w-4 mr-2" />
                  移除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 优化比较函数，减少不必要的检查
    return (
      prevProps.song.id === nextProps.song.id &&
      prevProps.isCurrentSong === nextProps.isCurrentSong &&
      prevProps.isDeleting === nextProps.isDeleting
    );
  }
);

export function PlaylistPanel() {
  const playlist = usePlayerStore((s) => s.playlist);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const showPlaylist = usePlayerStore((s) => s.showPlaylist);
  const setShowPlaylist = usePlayerStore((s) => s.setShowPlaylist);
  const playAtIndex = usePlayerStore((s) => s.playAtIndex);
  const removeFromPlaylist = usePlayerStore((s) => s.removeFromPlaylist);
  const clearPlaylist = usePlayerStore((s) => s.clearPlaylist);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const moveInPlaylist = usePlayerStore((s) => s.moveInPlaylist);

  const { addTask } = useDownloadStore();
  const { defaultQuality } = useSettingsStore();

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 配置拖拽传感器 - 优化性能
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 增加激活距离，减少误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 播放指定歌曲
  const handlePlaySong = (index: number) => {
    // 如果正在删除操作中，忽略点击事件
    if (isDeleting) {
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
    setIsDeleting(true);

    removeFromPlaylist(index);

    // 300ms后解除删除状态，防止意外点击
    setTimeout(() => {
      setIsDeleting(false);
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
                  <div className="h-full overflow-y-auto overscroll-contain">
                    <div className="p-2 space-y-1">
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
