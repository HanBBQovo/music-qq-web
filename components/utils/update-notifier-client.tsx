"use client";

import { useUpdateNotifier } from "@/lib/hooks/use-update-notifier";

export function UpdateNotifierClient() {
  useUpdateNotifier();
  return null;
}
