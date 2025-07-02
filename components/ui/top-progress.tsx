"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

// 全局 NProgress 配置
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 120,
});

export function TopProgress() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // 第一次渲染不触发
    if (first.current) {
      first.current = false;
      return;
    }

    NProgress.start();
    // 300ms 后结束，确保可见
    const timer = setTimeout(() => {
      NProgress.done();
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
