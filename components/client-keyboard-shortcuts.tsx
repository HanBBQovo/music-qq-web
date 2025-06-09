"use client";

import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";

export function ClientKeyboardShortcuts() {
  // 使用键盘快捷键hook
  useKeyboardShortcuts();

  // 不渲染任何UI
  return null;
}
