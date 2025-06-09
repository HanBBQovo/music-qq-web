import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { MiniPlayer } from "@/components/player/mini-player";
import { ClientKeyboardShortcuts } from "@/components/client-keyboard-shortcuts";
import { MainNav } from "@/components/layout/main-nav";
import { Footer } from "@/components/layout/footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QQ 音乐 Web 版",
  description: "基于 Next.js 的在线音乐播放器",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <MainNav />
            <main className="flex-1 pb-20">{children}</main>
            <Footer />
            <MiniPlayer />
            <Toaster />
            <ClientKeyboardShortcuts />
          </div>
        </Providers>
      </body>
    </html>
  );
}
