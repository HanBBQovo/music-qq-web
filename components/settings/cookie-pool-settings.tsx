import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  AlertCircle,
  Check,
  Server,
  ShieldCheck,
  Info,
  Cloud,
  PlusCircle,
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
import { Separator } from "@/components/ui/separator";

import useSettingsStore from "@/lib/store/useSettingsStore";
import cookiePoolApi from "@/lib/api/cookie-pool-client";
import { CookieStatsResponse, CookiePoolItem } from "@/lib/types/cookie-pool";

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

  // 自动重试机制
  useEffect(() => {
    if (apiError && Date.now() - lastRetryTime > 10000) {
      setLastRetryTime(Date.now());
      handleRetry();
    }
  }, [apiError, lastRetryTime]);

  // 处理重试
  const handleRetry = async () => {
    setRetrying(true);
    try {
      await loadCookieData();
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "API连接失败");
    } finally {
      setRetrying(false);
    }
  };

  // 加载Cookie数据
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

        // 自动选择逻辑
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
            toast.success("已自动选择可用的Cookie");
          }
        }
      } else {
        throw new Error(listResponse.message || "获取Cookie列表失败");
      }
    } catch (error) {
      console.error("获取Cookie池数据失败:", error);
      setApiError(error instanceof Error ? error.message : "API连接失败");
      toast.error("获取Cookie池数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 切换Cookie池
  const handleTogglePool = (checked: boolean) => {
    setUseCookiePool(checked);
    if (checked) {
      loadCookieData();
      toast.success("已启用Cookie池");
    } else {
      toast.info("已禁用Cookie池");
    }
  };

  // 组件加载时获取统计信息
  useEffect(() => {
    if (useCookiePool) {
      loadCookieData();
    }
  }, []);

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
        toast.success("Cookie提交成功");
        setNewCookie("");
        if (useCookiePool) {
          setSelectedCookieId(response.data.cookie_id);
        }
        loadCookieData();
      } else {
        toast.error("提交失败", { description: response.message });
      }
    } catch (error) {
      console.error("提交Cookie失败:", error);
      toast.error("提交Cookie失败");
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

  // 获取VIP等级样式（参考音质选择的VIP/SVIP样式）
  const getVipBadge = (vipLevel: string) => {
    const level = vipLevel.toUpperCase();

    if (level.includes("SVIP") || level.includes("豪华")) {
      return (
        <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm">
          SVIP
        </span>
      );
    } else if (level.includes("VIP") || level.includes("绿钻")) {
      return (
        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
          VIP
        </span>
      );
    } else {
      return (
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {vipLevel}
        </span>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Cookie池开关 */}
      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div className="space-y-0.5">
          <Label className="font-medium">使用Cookie池</Label>
          <p className="text-xs text-muted-foreground">
            启用后，将使用Cookie池中的Cookie进行API请求，而不是个人Cookie
          </p>
        </div>
        <Switch checked={useCookiePool} onCheckedChange={handleTogglePool} />
      </div>

      {useCookiePool && (
        <div className="p-3 bg-muted/30 rounded-lg border space-y-4">
          {/* API错误提示 */}
          {apiError && !loading && (
            <div className="p-2 bg-destructive/10 rounded border border-destructive/20">
              <div className="flex items-start gap-2">
                <Server className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-destructive font-medium">
                    API连接错误
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {apiError}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
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
                      {retrying ? "重试中..." : "重试"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {retrying ? "正在重新连接..." : "将在10秒后自动重试"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cookie池状态 */}
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <h5 className="text-sm font-medium">Cookie池状态</h5>
              {stats ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          stats.active_count > 0
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      />
                      <span className="text-muted-foreground">
                        总数: {stats.total_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">
                        活跃: {stats.active_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">
                        错误: {stats.error_count}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs max-w-fit ${
                      stats.active_count === 0
                        ? "border-amber-500 text-amber-600"
                        : "border-green-500 text-green-600"
                    }`}
                  >
                    {stats.active_count === 0 ? (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        无可用Cookie
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        正常运行中
                      </>
                    )}
                  </Badge>
                </div>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 animate-pulse">
                    <Skeleton className="w-16 h-4" />
                    <Skeleton className="w-12 h-4" />
                    <Skeleton className="w-14 h-4" />
                  </div>
                  <Badge
                    variant="outline"
                    className="animate-pulse text-xs max-w-fit"
                  >
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    加载中...
                  </Badge>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    无法获取统计信息
                  </p>
                  <Badge
                    variant="outline"
                    className="border-red-500 text-red-600 text-xs max-w-fit"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    连接失败
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 ml-3">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCookieData}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
              <div className="flex items-center gap-1 text-xs">
                <div
                  className={`w-2 h-2 rounded-full ${
                    apiError
                      ? "bg-red-500"
                      : loading
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }`}
                />
                <span className="text-muted-foreground">
                  {apiError ? "连接失败" : loading ? "连接中..." : "已连接"}
                </span>
              </div>
            </div>
          </div>

          {/* Cookie选择 */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              选择Cookie
            </Label>
            {loading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={selectedCookieId}
                onValueChange={handleSelectCookie}
                disabled={
                  cookies.filter((c) => c.status === "active").length === 0
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue
                    placeholder={
                      cookies.filter((c) => c.status === "active").length === 0
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
                      return (
                        <SelectItem
                          key={cookie.id}
                          value={cookie.id}
                          disabled={!isActive}
                        >
                          <div className="flex items-center justify-between w-full min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isActive ? (
                                <ShieldCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm truncate">
                                {cookie.nickname}
                              </span>
                              {getVipBadge(cookie.vip_level)}
                            </div>
                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0 hidden sm:block">
                              {formatDate(cookie.added_time)}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              从Cookie池中选择一个可用的Cookie进行API请求
            </p>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <strong>提示：</strong>
            Cookie池与个人Cookie为二选一关系。启用Cookie池后，您的个人Cookie将不再生效。
          </div>
        </div>
      </div>

      <Separator />

      {/* Cookie提交表单 */}
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
          您可以将自己的音乐Cookie提交到公共Cookie池，与他人共享VIP特权
        </p>

        <Textarea
          value={newCookie}
          onChange={(e) => setNewCookie(e.target.value)}
          placeholder="粘贴音乐Cookie，格式: uin=xxx; qm_keyst=xxx; ..."
          rows={2}
          className="resize-none text-sm"
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitting || !newCookie.trim()}
            onClick={handleSubmitCookie}
            size="sm"
          >
            <Cloud className="h-4 w-4 mr-1.5" />
            {submitting ? "提交中..." : "提交Cookie"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookiePoolSettings;
