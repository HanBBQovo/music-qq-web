"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  MoonIcon,
  SunIcon,
  HomeIcon,
  DownloadIcon,
  SettingsIcon,
  MusicIcon,
  MenuIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SettingsDialog } from "@/components/settings/settings-dialog";

export function MainNav() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 避免水合错误
  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { name: "首页", href: "/", icon: HomeIcon },
    { name: "下载", href: "/download", icon: DownloadIcon },
  ];

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 lg:px-6">
        <div className="mr-6 flex items-center">
          <Link href="/" className="mr-8 flex items-center space-x-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 group-hover:from-purple-600 group-hover:to-blue-700 transition-all duration-200 shadow-lg group-hover:shadow-xl">
              <MusicIcon className="h-6 w-6 text-white" />
            </div>
            <span className="hidden font-bold text-lg inline-block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              QQ音乐下载
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = mounted && pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer relative",
                    isActive
                      ? "text-white bg-gradient-to-r from-purple-500 to-blue-600 shadow-md"
                      : "text-foreground/70 hover:text-foreground hover:bg-primary/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* 搜索框位置，可以后续添加 */}
          </div>

          <nav className="flex items-center gap-3">
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-2 hover:border-primary/30 transition-all duration-200 cursor-pointer"
                  >
                    <MenuIcon className="h-5 w-5" />
                    <span className="sr-only">打开菜单</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="p-0 w-[280px] [&>button]:hidden"
                >
                  <div className="flex flex-col h-full">
                    <SheetHeader className="border-b">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
                            <MusicIcon className="h-5 w-5 text-white" />
                          </div>
                          <SheetTitle className="font-bold text-lg bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            QQ音乐下载器
                          </SheetTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleMobileMenuClose}
                          className="h-8 w-8 rounded-lg hover:bg-muted"
                        >
                          <XIcon className="h-4 w-4" />
                          <span className="sr-only">关闭菜单</span>
                        </Button>
                      </div>
                    </SheetHeader>

                    <div className="flex-1 p-4">
                      <nav className="space-y-2">
                        {navItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = mounted && pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={handleMobileMenuClose}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer w-full",
                                isActive
                                  ? "text-white bg-gradient-to-r from-purple-500 to-blue-600 shadow-md"
                                  : "text-foreground/70 hover:text-foreground hover:bg-primary/10"
                              )}
                            >
                              <Icon className="h-5 w-5" />
                              {item.name}
                            </Link>
                          );
                        })}
                      </nav>
                    </div>

                    <div className="p-4 border-t">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground px-2">
                          主题设置
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTheme("light")}
                            className="flex-1 cursor-pointer"
                          >
                            <SunIcon className="h-4 w-4 mr-2" />
                            浅色
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTheme("dark")}
                            className="flex-1 cursor-pointer"
                          >
                            <MoonIcon className="h-4 w-4 mr-2" />
                            深色
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="md:hidden">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="h-10 w-10 rounded-xl border-2 hover:border-primary/30 transition-all duration-200 cursor-pointer"
              >
                <SettingsIcon className="h-5 w-5" />
                <span className="sr-only">设置</span>
              </Button>
            </div>

            <div className="hidden md:block">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="h-10 w-10 rounded-xl border-2 hover:border-primary/30 transition-all duration-200 cursor-pointer"
              >
                <SettingsIcon className="h-5 w-5" />
                <span className="sr-only">设置</span>
              </Button>
            </div>
          </nav>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
