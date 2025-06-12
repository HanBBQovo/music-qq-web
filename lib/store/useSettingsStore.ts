import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AudioQuality } from "../api/types";

interface SettingsState {
  // 音质设置
  defaultQuality: AudioQuality;
  setDefaultQuality: (quality: AudioQuality) => void;

  // 音质降级设置
  enableQualityFallback: boolean;
  setEnableQualityFallback: (enabled: boolean) => void;

  // Cookie设置
  cookie: string;
  setCookie: (cookie: string) => void;

  // 元数据设置
  autoAddMetadata: boolean;
  setAutoAddMetadata: (enabled: boolean) => void;

  autoAddCover: boolean;
  setAutoAddCover: (enabled: boolean) => void;

  // 下载路径设置
  downloadBehavior: "auto" | "ask";
  setDownloadBehavior: (behavior: "auto" | "ask") => void;

  showSaveNotification: boolean;
  setShowSaveNotification: (enabled: boolean) => void;

  // 重置设置
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // 音质设置
      defaultQuality: "320",
      setDefaultQuality: (quality: AudioQuality) =>
        set({ defaultQuality: quality }),

      // 音质降级设置
      enableQualityFallback: false,
      setEnableQualityFallback: (enabled: boolean) =>
        set({ enableQualityFallback: enabled }),

      // Cookie设置
      cookie: "",
      setCookie: (cookie: string) => {
        console.log("[设置Store] setCookie调用:", {
          newCookie: cookie.substring(0, 50) + "...",
          cookieLength: cookie.length,
          timestamp: new Date().toISOString(),
        });

        try {
          // 同时保存到localStorage，供API客户端使用
          localStorage.setItem("music_cookie", cookie);
          console.log("[设置Store] localStorage已保存music_cookie");

          // 更新zustand store状态
          set({ cookie });
          console.log("[设置Store] zustand store状态已更新");
        } catch (error) {
          console.error("[设置Store] setCookie失败:", error);
        }
      },

      // 元数据设置
      autoAddMetadata: true,
      setAutoAddMetadata: (enabled: boolean) =>
        set({ autoAddMetadata: enabled }),

      autoAddCover: true,
      setAutoAddCover: (enabled: boolean) => set({ autoAddCover: enabled }),

      // 下载路径设置
      downloadBehavior: "auto",
      setDownloadBehavior: (behavior: "auto" | "ask") =>
        set({ downloadBehavior: behavior }),

      showSaveNotification: true,
      setShowSaveNotification: (enabled: boolean) =>
        set({ showSaveNotification: enabled }),

      // 重置设置
      resetSettings: () => {
        try {
          localStorage.removeItem("settings-store");
          localStorage.removeItem("music_cookie");
          set({
            defaultQuality: "320",
            enableQualityFallback: false,
            cookie: "",
            autoAddMetadata: true,
            autoAddCover: true,
            downloadBehavior: "auto",
            showSaveNotification: true,
          });
        } catch (error) {
          console.warn("重置设置失败:", error);
        }
      },
    }),
    {
      name: "settings-store", // localStorage存储的键名
      onRehydrateStorage: () => {
        console.log("[设置Store] onRehydrateStorage开始恢复设置...");

        // 当store从持久化存储中恢复后，确保cookie同步到localStorage
        return (rehydratedState) => {
          console.log("[设置Store] 设置恢复完成:", {
            hasState: !!rehydratedState,
            cookie: rehydratedState?.cookie?.substring(0, 50) + "..." || "无",
            cookieLength: rehydratedState?.cookie?.length || 0,
            defaultQuality: rehydratedState?.defaultQuality,
          });

          if (rehydratedState && rehydratedState.cookie) {
            try {
              localStorage.setItem("music_cookie", rehydratedState.cookie);
              console.log("[设置Store] 恢复时同步cookie到localStorage成功");
            } catch (error) {
              console.error("[设置Store] 恢复时同步cookie失败:", error);
            }
          } else {
            console.log("[设置Store] 没有cookie需要恢复");
          }
        };
      },
    }
  )
);

export default useSettingsStore;
