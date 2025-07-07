"use client";

import { useState, useEffect } from "react";
import {
  Check,
  Download,
  Moon,
  Music,
  Settings,
  Sun,
  X,
  Cookie,
  Disc3,
  Image,
  Headphones,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import useSettingsStore from "@/lib/store/useSettingsStore";
import { useDownloadStore } from "@/lib/store";
import type { AudioQuality } from "@/lib/api/types";

import CookiePoolSettings from "./cookie-pool-settings";

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const audioQualities: {
  value: AudioQuality;
  label: string;
  description: string;
  requiresVip?: boolean;
  requiresSvip?: boolean;
}[] = [
  {
    value: "128",
    label: "MP3 (128kbps)",
    description: "较小文件大小，普通音质",
  },
  {
    value: "320",
    label: "MP3 (320kbps)",
    description: "较大文件大小，高音质",
  },
  {
    value: "flac",
    label: "FLAC 无损",
    description: "最大文件大小，无损音质",
    requiresVip: true,
  },
  {
    value: "ATMOS_51",
    label: "臻品音质2.0",
    description: "16Bit 44.1kHz",
    requiresSvip: true,
  },
  {
    value: "ATMOS_2",
    label: "臻品全景声2.0",
    description: "16Bit 44.1kHz",
    requiresSvip: true,
  },
  {
    value: "MASTER",
    label: "臻品母带2.0",
    description: "24Bit 192kHz",
    requiresSvip: true,
  },
];

export function SettingsDialog({
  open,
  onOpenChange,
  children,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 从设置store获取状态
  const {
    defaultQuality,
    setDefaultQuality,
    enableQualityFallback,
    setEnableQualityFallback,
    cookie,
    setCookie,
    autoAddMetadata,
    setAutoAddMetadata,
    autoAddCover,
    setAutoAddCover,
    downloadBehavior,
    setDownloadBehavior,
    showSaveNotification,
    setShowSaveNotification,
    useCookiePool,
  } = useSettingsStore();

  // 从下载store获取状态
  const {
    maxConcurrentDownloads,
    setMaxConcurrentDownloads,
    adaptiveConcurrent,
    setAdaptiveConcurrent,
  } = useDownloadStore();

  // 本地状态
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [cookieValue, setCookieValue] = useState("");

  useEffect(() => {
    setMounted(true);

    // 组件挂载后，从localStorage直接读取cookie值
    if (typeof window !== "undefined") {
      const storedCookie = localStorage.getItem("music_cookie") || "";
      setCookieValue(storedCookie);
    }
  }, []);

  // 当store中的cookie更新时，同步到本地状态
  useEffect(() => {
    if (cookie && cookie !== cookieValue) {
      setCookieValue(cookie);
    }
  }, [cookie]);

  // 当全局主题变化时，同步到本地UI状态
  useEffect(() => {
    if (theme) {
      setSelectedTheme(theme);
    }
  }, [theme]);

  const handleSave = () => {
    // 保存设置
    setCookie(cookieValue || "");
    setTheme(selectedTheme as string);

    toast.success("设置已保存", {
      description: "您的偏好设置已成功保存。",
    });

    onOpenChange?.(false);
  };

  const handleReset = () => {
    // 重置为默认值
    setDefaultQuality("320");
    setEnableQualityFallback(false);
    setCookieValue("");
    setAutoAddMetadata(true);
    setAutoAddCover(true);
    setMaxConcurrentDownloads(2);
    setAdaptiveConcurrent(true);
    setSelectedTheme("light");
    setDownloadBehavior("auto");
    setShowSaveNotification(true);

    toast.success("设置已重置", {
      description: "所有设置已恢复为默认值。",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            应用设置
          </DialogTitle>
          <DialogDescription>
            自定义您的下载偏好、音质设置和应用程序行为。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 min-h-0">
          <Tabs defaultValue="quality" className="w-full">
            <TabsList className="grid w-full grid-cols-4 sticky top-0 bg-background z-10">
              <TabsTrigger value="quality">音质</TabsTrigger>
              <TabsTrigger value="download">下载</TabsTrigger>
              <TabsTrigger value="cookie">Cookie</TabsTrigger>
              <TabsTrigger value="theme">主题</TabsTrigger>
            </TabsList>

            <div className="pt-4">
              <TabsContent value="quality" className="space-y-4 py-0 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Headphones className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-medium">音质降级设置</h4>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label className="font-medium">启用音质自动降级</Label>
                      <p className="text-sm text-muted-foreground">
                        当VIP权限不足或音质不可用时，自动降级到较低音质。
                      </p>
                    </div>
                    <Switch
                      checked={enableQualityFallback}
                      onCheckedChange={setEnableQualityFallback}
                    />
                  </div>

                  {enableQualityFallback && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                          ℹ️
                        </div>
                        <div className="text-xs text-blue-800 dark:text-blue-200">
                          <strong>降级顺序：</strong>
                          臻品母带2.0 → 臻品全景声2.0 → 臻品音质2.0 → FLAC无损 →
                          MP3 320kbps → MP3 128kbps
                          <br />
                          系统会从您选择的音质开始，依次尝试较低音质直到找到可用资源。
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center gap-2 mb-3">
                    <Music className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-medium">默认音质选择</h4>
                  </div>
                  <RadioGroup
                    value={defaultQuality}
                    onValueChange={(value: AudioQuality) =>
                      setDefaultQuality(value)
                    }
                    className="space-y-3"
                  >
                    {audioQualities.map((quality) => (
                      <div
                        key={quality.value}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem
                            value={quality.value}
                            id={quality.value}
                          />
                          <div>
                            <Label
                              htmlFor={quality.value}
                              className="font-medium cursor-pointer flex items-center gap-2"
                            >
                              {quality.label}
                              {quality.requiresVip && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
                                  VIP
                                </span>
                              )}
                              {quality.requiresSvip && (
                                <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm">
                                  SVIP
                                </span>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {quality.description}
                            </p>
                          </div>
                        </div>
                        <Headphones className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </TabsContent>

              <TabsContent value="download" className="space-y-4 py-0 mt-0">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Download className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-medium">下载设置</h4>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2 font-medium">
                          <Disc3 className="h-4 w-4" />
                          自动添加元数据
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          自动为下载的音乐文件添加歌曲信息、歌词等元数据
                        </p>
                      </div>
                      <Switch
                        checked={autoAddMetadata}
                        onCheckedChange={setAutoAddMetadata}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2 font-medium">
                          <Image className="h-4 w-4" />
                          自动添加专辑封面
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          自动为下载的音乐文件添加专辑封面图片
                        </p>
                      </div>
                      <Switch
                        checked={autoAddCover}
                        onCheckedChange={setAutoAddCover}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">并发下载设置</h4>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-0.5">
                          <Label className="font-medium">最大同时下载数</Label>
                          <p className="text-xs text-muted-foreground">
                            设置同时进行的下载任务数量，建议1-2个以获得最佳性能
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={maxConcurrentDownloads}
                            onChange={(e) =>
                              setMaxConcurrentDownloads(
                                parseInt(e.target.value)
                              )
                            }
                            className="flex h-9 w-16 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-center"
                          >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                          </select>
                          <span className="text-sm text-muted-foreground">
                            个
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-0.5">
                          <Label className="font-medium">自适应并发调整</Label>
                          <p className="text-xs text-muted-foreground">
                            根据网络状况和后端负载自动调整并发下载数量
                          </p>
                        </div>
                        <Switch
                          checked={adaptiveConcurrent}
                          onCheckedChange={setAdaptiveConcurrent}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">文件保存设置</h4>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <Label className="font-medium">下载行为</Label>
                        <RadioGroup
                          value={downloadBehavior}
                          onValueChange={(value: "auto" | "ask") =>
                            setDownloadBehavior(value)
                          }
                          className="space-y-2"
                        >
                          <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="auto" id="download-auto" />
                              <div>
                                <Label
                                  htmlFor="download-auto"
                                  className="font-medium cursor-pointer"
                                >
                                  自动保存到下载文件夹
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  推荐：直接下载到浏览器默认下载位置，无需每次选择
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="ask" id="download-ask" />
                              <div>
                                <Label
                                  htmlFor="download-ask"
                                  className="font-medium cursor-pointer"
                                >
                                  每次询问保存位置
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  每次下载时弹出文件保存对话框选择位置
                                </p>
                              </div>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-0.5">
                          <Label className="font-medium">下载完成通知</Label>
                          <p className="text-xs text-muted-foreground">
                            下载完成后显示成功通知消息
                          </p>
                        </div>
                        <Switch
                          checked={showSaveNotification}
                          onCheckedChange={setShowSaveNotification}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cookie" className="space-y-4 py-0 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cookie className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-medium">Cookie设置</h4>
                  </div>

                  <CookiePoolSettings />

                  <Separator className="my-4" />

                  <div className="flex items-center gap-2 mb-2">
                    <Cookie className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-medium">平台Cookie设置</h4>
                  </div>

                  <div className="space-y-3">
                    <Textarea
                      id="cookie-input"
                      placeholder="请粘贴音乐平台的Cookie值..."
                      value={cookieValue}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setCookieValue(e.target.value)
                      }
                      rows={3}
                      className={`resize-none ${
                        useCookiePool
                          ? "bg-muted cursor-not-allowed opacity-60"
                          : ""
                      }`}
                      disabled={useCookiePool}
                    />
                    {useCookiePool ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <X className="h-3 w-3" />
                        已启用Cookie池，个人Cookie已禁用
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        💡
                        提供Cookie可以下载VIP歌曲和更高音质。请从音乐平台网页版的开发者工具中获取Cookie。
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                        ⚠️
                      </div>
                      <div className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>隐私提醒：</strong>
                        您的Cookie仅在本地存储，不会上传到任何服务器。请定期更新Cookie以保持功能正常。
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="theme" className="space-y-4 py-0 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sun className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-medium">主题设置</h4>
                  </div>

                  <RadioGroup
                    value={selectedTheme}
                    onValueChange={(value) =>
                      setSelectedTheme(value as "light" | "dark" | "system")
                    }
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="light" id="theme-light" />
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          <Label
                            htmlFor="theme-light"
                            className="font-medium cursor-pointer"
                          >
                            浅色模式
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="dark" id="theme-dark" />
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          <Label
                            htmlFor="theme-dark"
                            className="font-medium cursor-pointer"
                          >
                            深色模式
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="system" id="theme-system" />
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          <Label
                            htmlFor="theme-system"
                            className="font-medium cursor-pointer"
                          >
                            跟随系统
                          </Label>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <Separator />

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1 mr-2"
          >
            重置默认
          </Button>
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              className="flex-1"
            >
              取消
            </Button>
            <Button onClick={handleSave} className="flex-1">
              <Check className="mr-2 h-4 w-4" />
              保存设置
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
