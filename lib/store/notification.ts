import type { StateCreator } from "zustand";

export interface NotificationSlice {
  isUpdateNoticeVisible: boolean;
  updateChangelog: string | null;
  showUpdateNotice: (changelog: string) => void;
  hideUpdateNotice: () => void;
}

export const createNotificationSlice: StateCreator<
  NotificationSlice,
  [],
  [],
  NotificationSlice
> = (set) => ({
  isUpdateNoticeVisible: false,
  updateChangelog: null,
  showUpdateNotice: (changelog) =>
    set({ isUpdateNoticeVisible: true, updateChangelog: changelog }),
  hideUpdateNotice: () => set({ isUpdateNoticeVisible: false }),
});
