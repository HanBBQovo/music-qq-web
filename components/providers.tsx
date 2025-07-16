"use client";

import { ThemeProvider } from "next-themes";
import { UpdateNotifierClient } from "./utils/update-notifier-client";
import { UpdateNotification } from "./notifications/update-notification";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="music-web-theme"
    >
      {children}
      <UpdateNotifierClient />
      <UpdateNotification />
    </ThemeProvider>
  );
}
