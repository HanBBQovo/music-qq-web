"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  LinkIcon,
  LoaderIcon,
  XIcon,
  MusicIcon,
  AlbumIcon,
  ListMusicIcon,
  ArrowRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  parseMusicLink,
  parseMusicLinkServer,
  generateRedirectUrl,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const linkParseSchema = z.object({
  url: z.string().min(1, "请输入音乐平台链接"),
});

type LinkParseValues = z.infer<typeof linkParseSchema>;

export function LinkParser() {
  const router = useRouter();
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    type?: "song" | "album" | "playlist";
    id?: string;
    mid?: string;
    playlistData?: {
      name: string;
      songs: string[];
      songCount: number;
    };
  } | null>(null);

  const form = useForm<LinkParseValues>({
    resolver: zodResolver(linkParseSchema),
    defaultValues: {
      url: "",
    },
  });

  function getTypeText(type?: string) {
    switch (type) {
      case "song":
        return "歌曲";
      case "album":
        return "专辑";
      case "playlist":
        return "歌单";
      default:
        return "音乐内容";
    }
  }

  function getTypeIcon(type?: string) {
    switch (type) {
      case "song":
        return MusicIcon;
      case "album":
        return AlbumIcon;
      case "playlist":
        return ListMusicIcon;
      default:
        return LinkIcon;
    }
  }

  function getTypeColor(type?: string) {
    switch (type) {
      case "song":
        return "bg-blue-500/10 text-blue-500";
      case "album":
        return "bg-amber-500/10 text-amber-500";
      case "playlist":
        return "bg-green-500/10 text-green-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  }

  async function onSubmit(data: LinkParseValues) {
    setIsParsingLink(true);
    setParseResult(null);

    try {
      // 先尝试前端解析
      const frontendResult = parseMusicLink(data.url);
      console.log("前端解析结果:", frontendResult);

      if (frontendResult.success && frontendResult.id) {
        setParseResult(frontendResult);
        toast.success(`检测到${getTypeText(frontendResult.type)}链接`);
        return;
      }

      // 如果前端解析失败，调用后端API
      if (frontendResult.needServerParsing || !frontendResult.success) {
        toast.info("正在解析链接...");
        const serverResult = await parseMusicLinkServer(data.url);
        console.log("后端解析结果:", serverResult);

        if (serverResult.success) {
          setParseResult(serverResult);
          toast.success(`解析成功，发现${getTypeText(serverResult.type)}`);
        } else {
          toast.error(serverResult.error || "链接解析失败");
        }
      }
    } catch (error: any) {
      console.error("链接解析错误:", error);
      toast.error("链接解析失败，请检查链接是否有效");
    } finally {
      setIsParsingLink(false);
    }
  }

  function handleNavigate() {
    if (!parseResult) return;

    const redirectUrl = generateRedirectUrl(parseResult);
    if (redirectUrl) {
      // 如果有歌单数据，存储到sessionStorage
      if (parseResult.playlistData) {
        sessionStorage.setItem(
          "parsedPlaylistData",
          JSON.stringify(parseResult.playlistData)
        );
      }

      router.push(redirectUrl);
    } else {
      toast.error("无法生成跳转链接");
    }
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      <LinkIcon className="h-5 w-5" />
                    </div>
                    <Input
                      placeholder="粘贴音乐平台链接..."
                      {...field}
                      disabled={isParsingLink}
                      className="pl-11 h-12 text-base border-2 transition-colors focus-visible:ring-0 focus-visible:border-primary pr-10"
                    />
                    {field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full h-7 w-7 p-0 hover:bg-muted"
                        onClick={() => form.setValue("url", "")}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    disabled={isParsingLink}
                    className="h-12 px-6 font-medium transition-smooth hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      {isParsingLink ? (
                        <LoaderIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <LinkIcon className="h-4 w-4" />
                      )}
                      <span>{isParsingLink ? "解析中..." : "解析链接"}</span>
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>解析音乐链接</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {parseResult &&
              parseResult.success &&
              !parseResult.playlistData && (
                <Button
                  onClick={handleNavigate}
                  variant="default"
                  className="h-12 px-6 font-medium transition-smooth hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRightIcon className="h-4 w-4" />
                    <span>前往详情页</span>
                  </div>
                </Button>
              )}

            {parseResult && parseResult.playlistData && (
              <div className="text-sm text-muted-foreground">
                🎵 已解析歌单数据，显示如下
              </div>
            )}
          </div>
        </form>
      </Form>

      {/* 解析结果预览 */}
      {parseResult && parseResult.success && (
        <div className="p-4 bg-accent/50 rounded-lg border">
          <div className="flex items-center gap-3 mb-3">
            {(() => {
              const Icon = getTypeIcon(parseResult.type);
              return (
                <Badge
                  variant="outline"
                  className={getTypeColor(parseResult.type)}
                >
                  <Icon className="h-3.5 w-3.5 mr-1" />
                  {getTypeText(parseResult.type)}
                </Badge>
              );
            })()}
            <span className="font-medium">解析成功</span>
          </div>

          {parseResult.playlistData && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">歌单名称：</span>
                {parseResult.playlistData.name}
              </div>
              <div className="text-sm">
                <span className="font-medium">歌曲数量：</span>
                {parseResult.playlistData.songCount} 首
              </div>

              {/* 歌曲列表预览 */}
              <div className="space-y-2">
                <div className="text-sm font-medium">歌曲列表预览：</div>
                <div className="max-h-48 overflow-y-auto bg-background/50 rounded border p-3 space-y-1">
                  {parseResult.playlistData.songs
                    .slice(0, 10)
                    .map((song, index) => (
                      <div
                        key={index}
                        className="text-xs text-muted-foreground flex items-center gap-2"
                      >
                        <span className="text-primary font-mono min-w-[2rem]">
                          {index + 1}.
                        </span>
                        <span className="truncate">{song}</span>
                      </div>
                    ))}
                  {parseResult.playlistData.songs.length > 10 && (
                    <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                      ...还有 {parseResult.playlistData.songs.length - 10}{" "}
                      首歌曲
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
                ✅ 链接解析完成！歌单信息已成功获取
              </div>
            </div>
          )}

          {parseResult.id && !parseResult.playlistData && (
            <div className="text-sm">
              <span className="font-medium">ID：</span>
              {parseResult.id}
            </div>
          )}
        </div>
      )}

      {/* 支持的链接格式提示 */}
      <div className="text-xs text-muted-foreground space-y-2">
        <div className="font-medium">支持的音乐平台链接格式：</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          <div>• 歌曲：y.qq.com/n/ryqq/songDetail/...</div>
          <div>• 专辑：y.qq.com/n/ryqq/albumDetail/...</div>
          <div>• 歌单：y.qq.com/n/ryqq/playlist/...</div>
          <div>• 分享链接：c6.y.qq.com/base/fcgi-bin/u?__=...</div>
        </div>
      </div>
    </div>
  );
}
