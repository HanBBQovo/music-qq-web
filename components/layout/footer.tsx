import { Heart, Github, Music, Headphones, Star } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t bg-gradient-to-r from-background/95 to-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* 装饰性背景 */}
      <div className="absolute inset-0 bg-grid-white/[0.02] dark:bg-grid-white/[0.02]" />

      <div className="relative layout-container">
        <div className="py-8 lg:py-12">
          {/* 底部版权信息 */}
          <div className=" flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              © 2025 MusicHub
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="bg-muted/50 rounded-full px-2 py-1">
                仅供学习交流
              </span>
              <div className="flex items-center gap-4">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105"
                >
                  <div className="p-1.5 rounded-md bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <Github className="h-4 w-4" />
                  </div>
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
