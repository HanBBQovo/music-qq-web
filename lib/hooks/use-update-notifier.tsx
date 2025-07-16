"use client";

import React, { useEffect } from "react";
import { usePlayerStore } from "@/lib/store/player";

const POLLING_INTERVAL = 1000 * 60 * 5; // 5 minutes
const NOTIFIED_VERSION_KEY = "notified-version";

export function useUpdateNotifier() {
  useEffect(() => {
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
    const { showUpdateNotice } = usePlayerStore.getState();

    if (!appVersion || appVersion === "development") {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const response = await fetch(`/api/version?t=${new Date().getTime()}`);
        if (!response.ok) {
          console.error(
            "Failed to fetch version info, status:",
            response.status
          );
          return;
        }

        const data = await response.json();
        const serverVersion = data.version;
        const changelog = data.changelog;

        console.log(
          `[Update Check] Client: ${appVersion}, Server: ${serverVersion}`
        );

        const hasBeenNotified =
          sessionStorage.getItem(NOTIFIED_VERSION_KEY) === serverVersion;

        if (serverVersion && serverVersion !== appVersion && !hasBeenNotified) {
          console.log("✅ Version mismatch detected! Showing update notice.");
          sessionStorage.setItem(NOTIFIED_VERSION_KEY, serverVersion);
          showUpdateNotice(changelog);
        }
      } catch (error) {
        console.error("Error checking for app updates:", error);
      }
    };

    const intervalId = setInterval(checkForUpdates, POLLING_INTERVAL);

    // Check immediately on mount after a short delay
    const initialCheckTimeout = setTimeout(checkForUpdates, 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialCheckTimeout);
    };
  }, []);
}
