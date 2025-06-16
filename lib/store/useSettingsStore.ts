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

  // Cookie池设置
  useCookiePool: boolean;
  setUseCookiePool: (enabled: boolean) => void;

  selectedCookieId: string;
  setSelectedCookieId: (id: string) => void;

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
        try {
          // 同时保存到localStorage，供API客户端使用
          localStorage.setItem("music_cookie", cookie);

          // 更新zustand store状态
          set({ cookie });
        } catch (error) {}
      },

      // Cookie池设置
      useCookiePool: false,
      setUseCookiePool: (enabled: boolean) => {
        // 当启用Cookie池时，自动关闭自定义Cookie使用
        if (enabled) {
          localStorage.removeItem("music_cookie");
        } else {
          // 当禁用Cookie池且存在自定义Cookie时，恢复自定义Cookie
          set((state) => {
            if (state.cookie) {
              localStorage.setItem("music_cookie", state.cookie);
            }
            return {};
          });
        }
        set({ useCookiePool: enabled });
      },

      selectedCookieId: "",
      setSelectedCookieId: (id: string) => set({ selectedCookieId: id }),

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
            useCookiePool: false,
            selectedCookieId: "",
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
        // 当store从持久化存储中恢复后，确保cookie同步到localStorage
        return (rehydratedState) => {
          if (
            rehydratedState &&
            rehydratedState.cookie &&
            !rehydratedState.useCookiePool
          ) {
            try {
              localStorage.setItem("music_cookie", rehydratedState.cookie);
            } catch (error) {}
          }
        };
      },
    }
  )
);

export default useSettingsStore;
