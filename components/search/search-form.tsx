"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  SearchIcon,
  LoaderIcon,
  XIcon,
  MusicIcon,
  AlbumIcon,
  ListMusicIcon,
  LinkIcon,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useSearchStore } from "@/lib/store";
import { parseMusicLinkServer } from "@/lib/utils";

const searchTypes = [
  {
    value: "song",
    label: "歌曲",
    icon: MusicIcon,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    value: "album",
    label: "专辑",
    icon: AlbumIcon,
    color: "bg-amber-500/10 text-amber-500",
  },
  {
    value: "playlist",
    label: "歌单",
    icon: ListMusicIcon,
    color: "bg-green-500/10 text-green-500",
  },
  {
    value: "link",
    label: "链接解析",
    icon: LinkIcon,
    color: "bg-purple-500/10 text-purple-500",
  },
];

const searchFormSchema = z.object({
  query: z.string().min(1, "请输入搜索关键词或链接"),
  type: z.enum(["song", "album", "playlist", "link"]),
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

export function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 使用Zustand store
  const { isLoading, setSearchKey, setSearchType, search } = useSearchStore();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      query: searchParams.get("q") || "",
      type:
        (searchParams.get("type") as "song" | "album" | "playlist" | "link") ||
        "song",
    },
  });

  // 初始化表单时从URL参数加载搜索条件
  useEffect(() => {
    const q = searchParams.get("q");
    const type = searchParams.get("type");

    if (q) {
      form.setValue("query", q);
    }

    if (type && ["song", "album", "playlist", "link"].includes(type)) {
      form.setValue("type", type as "song" | "album" | "playlist" | "link");
      // 只有搜索类型才设置搜索类型状态
      if (type !== "link") {
        setSearchType(type as "song" | "album" | "playlist");
      }
    }

    // 如果有搜索参数，自动执行搜索
    if (q) {
      setSearchKey(q);
      search();
    }
  }, [searchParams, setSearchKey, setSearchType, search, form]);

  const selectedType = form.watch("type");
  const currentType = searchTypes.find((type) => type.value === selectedType);

  async function onSubmit(data: SearchFormValues) {
    try {
      // 如果是链接解析类型，进行特殊处理
      if (data.type === "link") {
        // 调用链接解析API
        const parseResult = await parseMusicLinkServer(data.query);

        if (parseResult.success && parseResult.type) {
          // 如果有歌单数据，存储到localStorage并跳转到解析结果页面
          if (parseResult.playlistData) {
            // 生成唯一ID并存储解析结果
            const parseId =
              Date.now().toString(36) + Math.random().toString(36).substr(2);
            localStorage.setItem(
              `parse_result_${parseId}`,
              JSON.stringify(parseResult)
            );

            toast.success("链接解析成功，正在跳转到结果页面...");
            router.push(`/parse-result/${parseId}`);
            return;
          }

          // 没有歌单数据时正常跳转到详情页
          if (parseResult.id || parseResult.mid) {
            let redirectUrl = "";
            switch (parseResult.type) {
              case "song":
                redirectUrl = `/song/${parseResult.mid}`;
                break;
              case "album":
                redirectUrl = `/album/${parseResult.mid}`;
                break;
              case "playlist":
                redirectUrl = `/playlist/${parseResult.id}`;
                break;
            }

            if (redirectUrl) {
              toast.success(
                `链接解析成功，正在跳转到${currentType?.label}详情页`
              );
              router.push(redirectUrl);
              return;
            }
          }
        }

        // 解析失败
        toast.error(parseResult.error || "链接解析失败，请检查链接是否有效");
        return;
      }

      // 执行正常搜索 - 只更新URL和状态，让useEffect触发搜索
      const urlSearchParams = new URLSearchParams({
        q: data.query,
        type: data.type,
      });

      router.push(`/?${urlSearchParams.toString()}`, { scroll: false });

      // 更新搜索关键词和搜索类型，但不直接调用search()
      // useEffect会监听到URL变化并自动触发搜索
      setSearchKey(data.query);
      setSearchType(data.type);

      // 不再显示toast，让store中的搜索逻辑处理所有提示
    } catch (error) {
      toast.error("操作失败，请重试");
      console.error("Search/Parse error:", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="w-full md:w-[200px]">
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 border-2 transition-colors focus:border-primary">
                      <SelectValue placeholder="搜索类型">
                        {currentType && (
                          <div className="flex items-center justify-center gap-2 w-full">
                            <Badge
                              variant="outline"
                              className={`${currentType.color} flex items-center justify-center`}
                            >
                              <currentType.icon className="h-3.5 w-3.5 mr-1" />
                              {currentType.label}
                            </Badge>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {searchTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`${type.color} flex items-center`}
                          >
                            <type.icon className="h-3.5 w-3.5 mr-1" />
                            {type.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10">
                      <SearchIcon className="h-5 w-5" />
                    </div>
                    <Input
                      placeholder={
                        selectedType === "link"
                          ? "粘贴音乐平台链接..."
                          : `输入${
                              currentType?.label || ""
                            }名称、歌手、关键词...`
                      }
                      {...field}
                      disabled={isLoading}
                      className={cn(
                        "pl-11 h-12 text-base border-2 transition-colors focus-visible:ring-0 focus-visible:border-primary",
                        field.value && "pr-10"
                      )}
                    />
                    {field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full h-7 w-7 p-0 hover:bg-muted z-10"
                        onClick={() => form.setValue("query", "")}
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 px-6 font-medium transition-all duration-200 hover:shadow-md w-full md:w-auto"
                >
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <LoaderIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <SearchIcon className="h-4 w-4" />
                    )}
                    <span>
                      {isLoading
                        ? "处理中..."
                        : selectedType === "link"
                        ? "解析链接"
                        : "搜索"}
                    </span>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>搜索音乐资源</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {selectedType !== "link" && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="space-y-2">
              <span className="text-muted-foreground font-medium text-sm block">
                热门搜索:
              </span>
              <div className="flex flex-wrap gap-2">
                {["周杰伦", "林俊杰", "薛之谦", "华语流行", "经典老歌"].map(
                  (term) => (
                    <Button
                      key={term}
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 rounded-full text-xs font-medium hover:bg-gradient-to-r hover:from-primary/10 hover:to-purple-600/10 hover:text-primary hover:border-primary/30 transition-all duration-200 cursor-pointer"
                      onClick={() => {
                        form.setValue("query", term);
                        form.handleSubmit(onSubmit)();
                      }}
                    >
                      {term}
                    </Button>
                  )
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              💡
              支持歌曲名、歌手名、专辑名搜索，也可以粘贴音乐平台分享链接直接解析
            </p>
          </div>
        )}
      </form>
    </Form>
  );
}
