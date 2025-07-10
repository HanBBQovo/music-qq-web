"use client";

import { useDownloadStore } from "@/lib/store/useDownloadStore";
import { useEffect } from "react";

export function StoreHydrationHandler() {
  useEffect(() => {
    // onFinishHydration is the correct API to listen for when hydration is complete
    const unsub = useDownloadStore.persist.onFinishHydration(() => {
      console.log("[StoreHydrationHandler] Download store hydration finished.");
      // Trigger a queue process to start any tasks that were pending before the page refresh
      useDownloadStore.getState().processQueue();

      // Unsubscribe after the first rehydration to prevent multiple executions
      unsub();
    });
  }, []);

  return null; // This component renders nothing
}
