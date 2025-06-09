# QQ 音乐 Web 播放器

基于 Next.js 15 和 React 19 构建的现代化音乐播放器，支持 QQ 音乐资源搜索、在线播放和下载。

## 功能特点

- 🔍 **搜索功能**：支持歌曲、专辑、歌单搜索
- 🎵 **在线播放**：支持在线播放音乐，带有播放列表管理
- 📱 **响应式设计**：完美适配桌面端和移动端
- 🌙 **深色模式**：支持深色/浅色主题切换
- ⌨️ **键盘快捷键**：支持空格播放暂停、方向键切换等
- 📁 **批量下载**：支持批量下载歌曲
- 🎚️ **音质选择**：支持多种音质下载（128k、320k、FLAC 等）
- 🔗 **链接解析**：支持歌单链接解析和播放

## 技术栈

- **前端**：Next.js 15 + React 19 + TypeScript
- **样式**：Tailwind CSS + Radix UI
- **状态管理**：Zustand
- **动画**：Framer Motion
- **音频处理**：Web Audio API
- **部署**：Vercel

## 环境配置

创建 `.env.local` 文件：

```bash
# API 配置
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 部署到 Vercel

1. **克隆项目**：

```bash
git clone <your-repo-url>
cd music-web
```

2. **安装依赖**：

```bash
npm install
```

3. **配置环境变量**：

   - 在 Vercel 控制台中设置 `NEXT_PUBLIC_API_URL`
   - 或使用 `.env.local` 文件

4. **部署**：

```bash
# 使用 Vercel CLI
npm i -g vercel
vercel

# 或者直接推送到 GitHub，通过 Vercel GitHub 集成自动部署
```

## 目录结构

```
/app                 # Next.js App Router
  /album             # 专辑详情页面
  /playlist          # 歌单详情页面
  /download          # 下载管理页面
  /parse-result      # 链接解析结果页面
/components          # 可复用组件
  /search            # 搜索相关组件
  /download          # 下载相关组件
  /player            # 播放器组件
  /parse             # 链接解析组件
  /layout            # 布局组件
  /ui                # UI基础组件
/lib                 # 工具库
  /api               # API客户端
  /store             # 状态管理
  /hooks             # 自定义钩子
  /utils             # 工具函数
  /types             # 类型定义
```

## 键盘快捷键

- `Space` - 播放/暂停
- `Ctrl/Cmd + ←/→` - 上一首/下一首
- `Shift + ←/→` - 快退/快进 10 秒
- `Shift + ↑/↓` - 音量调节 ±10%
- `Shift + 0-9` - 跳转到进度百分比
- `M` - 静音/取消静音

## API 接口

主要 API 端点：

- `/api/search` - 搜索歌曲、专辑或歌单
- `/api/song/url` - 获取歌曲播放 URL
- `/api/song/download` - 获取歌曲下载 URL
- `/api/album` - 获取专辑信息
- `/api/playlist` - 获取歌单信息

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

MIT
