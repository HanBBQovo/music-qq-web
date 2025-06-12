import React, { useState, useEffect } from "react";
import {
  Cookie,
  PlusCircle,
  Cloud,
  RefreshCw,
  Info,
  Check,
  ShieldCheck,
  AlertCircle,
  Server,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import useSettingsStore from "@/lib/store/useSettingsStore";
import cookiePoolApi from "@/lib/api/cookie-pool-client";
import { CookieStatsResponse, CookiePoolItem } from "@/lib/types/cookie-pool";
import { Separator } from "@/components/ui/separator";

const CookiePoolSettings: React.FC = () => {
  const {
    useCookiePool,
    setUseCookiePool,
    selectedCookieId,
    setSelectedCookieId,
    cookie,
  } = useSettingsStore();

  const [newCookie, setNewCookie] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<CookieStatsResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cookies, setCookies] = useState<CookiePoolItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [lastRetryTime, setLastRetryTime] = useState(0);

  // 添加自动重试机制
  useEffect(() => {
    // 如果有API错误且最后重试时间超过10秒，自动重试
    if (apiError && Date.now() - lastRetryTime > 10000) {
      setLastRetryTime(Date.now());
      handleRetry();
    }
  }, [apiError]);

  // 处理重试
  const handleRetry = async () => {
    setRetrying(true);
    try {
      await loadCookieData();
      setApiError(null);
    } catch (error) {
      // 重试仍然失败
      setApiError(error instanceof Error ? error.message : "API连接失败");
    } finally {
      setRetrying(false);
    }
  };

  // 修改加载Cookie数据函数，增加错误处理
  const loadCookieData = async () => {
    try {
      setLoading(true);
      setApiError(null);

      // 获取统计信息
      const statsResponse = await cookiePoolApi.getCookieStats();
      if (statsResponse.code === 0 && statsResponse.data) {
        setStats(statsResponse.data);
      } else {
        throw new Error(statsResponse.message || "获取Cookie池统计失败");
      }

      // 获取Cookie列表
      const listResponse = await cookiePoolApi.getCookieList();
      if (listResponse.code === 0 && listResponse.data) {
        setCookies(listResponse.data.cookies || []);

        // 如果未选择Cookie但列表有可用Cookie，自动选择第一个
        if (
          useCookiePool &&
          !selectedCookieId &&
          listResponse.data.cookies &&
          listResponse.data.cookies.length > 0
        ) {
          const activeCookies = listResponse.data.cookies.filter(
            (c) => c.status === "active"
          );
          if (activeCookies.length > 0) {
            setSelectedCookieId(activeCookies[0].id);
            toast.success("已自动选择可用的Cookie", {
              description: "Cookie池连接成功",
            });
          }
        } else if (
          selectedCookieId &&
          listResponse.data.cookies &&
          !listResponse.data.cookies.some(
            (c) => c.id === selectedCookieId && c.status === "active"
          )
        ) {
          // 如果当前选择的Cookie不可用，尝试切换到其他可用Cookie
          const activeCookies = listResponse.data.cookies.filter(
            (c) => c.status === "active"
          );
          if (activeCookies.length > 0) {
            toast.info("已自动切换到可用的Cookie", {
              description: "您之前选择的Cookie已不可用",
            });
            setSelectedCookieId(activeCookies[0].id);
          } else if (stats && stats.active_count === 0) {
            // 如果没有可用的Cookie，清除选择并提示
            setSelectedCookieId("");
            toast.warning("当前没有可用的Cookie", {
              description: "请稍后再试或提交新的Cookie",
            });
          }
        }
      } else {
        throw new Error(listResponse.message || "获取Cookie列表失败");
      }
    } catch (error) {
      console.error("获取Cookie池数据失败:", error);
      setApiError(error instanceof Error ? error.message : "API连接失败");
      // 显示错误提示
      toast.error("获取Cookie池数据失败", {
        description: error instanceof Error ? error.message : "请检查网络连接",
      });
    } finally {
      setLoading(false);
    }
  };

  // 切换Cookie池
  const handleTogglePool = (checked: boolean) => {
    setUseCookiePool(checked);
    if (checked) {
      // 如果开启Cookie池，自动加载数据
      loadCookieData();
      if (!apiError) {
        // 如果开启Cookie池时没有错误，显示成功消息
        toast.success("已启用Cookie池", {
          description: "API请求将使用共享Cookie",
        });
      }
    } else {
      // 如果关闭Cookie池，显示提示信息
      toast.info("已禁用Cookie池", {
        description: "API请求将使用您的个人Cookie",
      });
    }
  };

  // 组件加载时获取统计信息
  useEffect(() => {
    if (useCookiePool) {
      loadCookieData();
    }
  }, []); // 仅在组件挂载时加载，不依赖useCookiePool

  // 提交Cookie到池
  const handleSubmitCookie = async () => {
    if (!newCookie || newCookie.trim() === "") {
      toast.error("请输入有效的Cookie");
      return;
    }

    try {
      setSubmitting(true);
      const response = await cookiePoolApi.submitCookie(newCookie);

      if (response.code === 0 && response.data) {
        toast.success("Cookie提交成功", {
          description: "您的Cookie已成功添加到Cookie池",
        });
        setNewCookie("");

        // 如果用户已启用Cookie池，自动选择刚提交的Cookie
        if (useCookiePool) {
          setSelectedCookieId(response.data.cookie_id);
        }

        // 重新加载统计信息
        loadCookieData();
      } else {
        toast.error("提交失败", {
          description: response.message,
        });
      }
    } catch (error) {
      console.error("提交Cookie失败:", error);
      toast.error("提交Cookie失败", {
        description: "请检查网络连接",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 选择Cookie
  const handleSelectCookie = (id: string) => {
    setSelectedCookieId(id);
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-2 font-medium">
            使用Cookie池
          </Label>
          <p className="text-xs text-muted-foreground">
            启用后，将使用Cookie池中的Cookie进行API请求，而不是个人Cookie
          </p>
        </div>
        <Switch checked={useCookiePool} onCheckedChange={handleTogglePool} />
      </div>

      {useCookiePool && (
        <div className="p-3 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
          {/* API错误提示 */}
          {apiError && !loading && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 mb-3">
              <div className="flex items-start gap-2">
                <Server className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-red-700 dark:text-red-400">
                    API连接错误: {apiError}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={retrying || loading}
                      className="h-7 px-2 text-xs"
                    >
                      <RefreshCw
                        className={`h-3 w-3 mr-1 ${
                          retrying ? "animate-spin" : ""
                        }`}
                      />
                      {retrying ? "重试中..." : "立即重试"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {retrying ? "正在重新连接..." : "将在10秒后自动重试"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h5 className="text-sm font-medium">Cookie池状态</h5>
              {stats ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          stats.active_count > 0
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      ></span>
                      <span className="text-muted-foreground">
                        总数:{" "}
                        <span className="font-medium text-foreground">
                          {stats.total_count}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-muted-foreground">
                        活跃:{" "}
                        <span className="font-medium text-foreground">
                          {stats.active_count}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-muted-foreground">
                        错误:{" "}
                        <span className="font-medium text-foreground">
                          {stats.error_count}
                        </span>
                      </span>
                    </div>
                  </div>
                  {stats.active_count === 0 && (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-500 max-w-fit"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      无可用Cookie，请添加或稍后再试
                    </Badge>
                  )}
                  {stats.active_count > 0 && (
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-500 max-w-fit"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Cookie池正常运行中
                    </Badge>
                  )}
                </div>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 animate-pulse">
                    <div className="w-20 h-4 bg-muted rounded"></div>
                    <div className="w-14 h-4 bg-muted rounded"></div>
                    <div className="w-16 h-4 bg-muted rounded"></div>
                  </div>
                  <Badge variant="outline" className="animate-pulse max-w-fit">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    正在加载状态...
                  </Badge>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    无法获取Cookie池统计信息
                  </p>
                  <Badge
                    variant="outline"
                    className="border-red-500 text-red-500 max-w-fit"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    连接失败，请检查网络
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCookieData}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
                {loading ? "加载中" : "刷新"}
              </Button>
              <div className="flex items-center gap-1 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiError
                      ? "bg-red-500"
                      : loading
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }`}
                ></span>
                <span className="text-muted-foreground">
                  {apiError
                    ? "API连接失败"
                    : loading
                    ? "正在连接..."
                    : "API已连接"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="cookie-select"
              className="text-sm flex items-center gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              选择要使用的Cookie
            </Label>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <Select
                  value={selectedCookieId}
                  onValueChange={handleSelectCookie}
                  disabled={
                    cookies.filter((c) => c.status === "active").length === 0
                  }
                >
                  <SelectTrigger id="cookie-select" className="w-full">
                    <SelectValue
                      placeholder={
                        cookies.filter((c) => c.status === "active").length ===
                        0
                          ? "暂无可用Cookie"
                          : "选择一个Cookie"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cookies.length === 0 ? (
                      <SelectItem value="none" disabled>
                        暂无可用Cookie
                      </SelectItem>
                    ) : (
                      cookies.map((cookie) => {
                        const isActive = cookie.status === "active";
                        const isSelected = selectedCookieId === cookie.id;

                        return (
                          <SelectItem
                            key={cookie.id}
                            value={cookie.id}
                            disabled={!isActive}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isActive ? (
                                  <ShieldCheck className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="font-medium">
                                  {cookie.nickname}
                                </span>
                                <span
                                  className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                                    cookie.vip_level.includes("豪华")
                                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                      : cookie.vip_level.includes("绿钻")
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                  }`}
                                >
                                  {cookie.vip_level}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground ml-6 flex-shrink-0">
                                {formatDate(cookie.added_time)}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              从Cookie池中选择一个可用的Cookie进行API请求
            </p>
          </div>
        </div>
      )}

      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <div className="text-amber-600 dark:text-amber-400 mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <strong>提示：</strong>
            Cookie池与个人Cookie为二选一关系。启用Cookie池后，您的个人Cookie将不再生效。
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            提交Cookie到池中
          </h4>
          {cookie && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewCookie(cookie)}
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" />
              使用当前Cookie
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          您可以将自己的QQ音乐Cookie提交到公共Cookie池，与他人共享VIP特权
        </p>

        <Textarea
          value={newCookie}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setNewCookie(e.target.value)
          }
          placeholder="粘贴QQ音乐Cookie，格式: uin=xxx; qm_keyst=xxx; ..."
          rows={2}
          className="resize-none"
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitting}
            onClick={handleSubmitCookie}
          >
            <Cloud className="h-4 w-4 mr-1.5" />
            提交Cookie
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookiePoolSettings;
