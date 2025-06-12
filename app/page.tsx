"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MusicIcon,
  SearchIcon,
  HeadphonesIcon,
  DownloadIcon,
  StarIcon,
  ShieldCheckIcon,
} from "lucide-react";

// 轻微的动画变体
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function HomePage() {
  return (
    <div className="layout-container">
      <div className="space-y-8 md:space-y-12 py-6 md:py-8">
        {/* 页面标题 - 保持原有设计，添加轻微动画 */}
        <motion.div
          className="text-center space-y-4 md:space-y-6 py-6 md:py-8"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div
            className="mx-auto flex items-center justify-center h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg"
            variants={fadeInUp}
          >
            <HeadphonesIcon className="h-8 w-8 md:h-10 md:w-10 text-white" />
          </motion.div>
          <motion.div
            className="space-y-3 md:space-y-4 px-4"
            variants={fadeInUp}
          >
            <h1 className="text-3xl md:text-4xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent leading-tight">
              MusicHub
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
              搜索并下载高品质音乐资源，支持歌曲、专辑、歌单和链接解析
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-4 md:mt-6">
              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <ShieldCheckIcon className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                <span>安全可靠</span>
              </div>
              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <StarIcon className="h-3 w-3 md:h-4 md:w-4 text-yellow-500" />
                <span>高品质音频</span>
              </div>
              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <DownloadIcon className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                <span>批量下载</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* 搜索卡片 - 保持原有布局，添加轻微动画 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="border shadow-lg transition-all duration-300 hover:shadow-xl">
            <CardHeader className="border-b px-4 md:px-8 py-4 md:py-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <SearchIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl md:text-2xl">
                      音乐搜索与链接解析
                    </CardTitle>
                    <CardDescription className="text-sm md:text-base mt-1">
                      输入关键词搜索或粘贴音乐平台链接解析
                    </CardDescription>
                  </div>
                </div>
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-medium text-primary">
                  <MusicIcon className="h-4 w-4" />
                  多平台音乐资源
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-8">
              <Suspense
                fallback={
                  <div className="h-20 flex items-center justify-center">
                    正在加载...
                  </div>
                }
              >
                <SearchForm />
              </Suspense>
            </CardContent>
          </Card>
        </motion.div>

        {/* 搜索结果 */}
        <div>
          <Suspense
            fallback={
              <div className="h-32 flex items-center justify-center">
                正在加载搜索结果...
              </div>
            }
          >
            <SearchResults />
          </Suspense>
        </div>

        {/* 特性介绍 - 保持原有设计，添加轻微动画 */}
        <motion.div
          className="mt-16 md:mt-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="text-center space-y-3 md:space-y-4 mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold">功能特点</h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              为您提供最佳的音乐下载体验
            </p>
          </div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={fadeInUp}>
              <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-3 md:mb-4 p-2.5 md:p-3 w-fit rounded-xl bg-blue-500 text-white">
                    <MusicIcon className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                  <CardTitle className="text-lg md:text-xl mb-2">
                    多种音质选择
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base">
                    支持M4A, MP3, FLAC, Hi-Res等多种音质格式下载
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm md:text-base">
                    从标准音质到无损FLAC，满足不同音质需求，VIP账号还可下载臻品母带和臻品全景声
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-3 md:mb-4 p-2.5 md:p-3 w-fit rounded-xl bg-green-500 text-white">
                    <SearchIcon className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                  <CardTitle className="text-lg md:text-xl mb-2">
                    多维度搜索
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base">
                    支持歌曲、专辑、歌单搜索和链接解析
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm md:text-base">
                    精准定位您想要的音乐资源，支持歌手名、专辑名、歌曲名的组合搜索，以及音乐平台分享链接解析
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-3 md:mb-4 p-2.5 md:p-3 w-fit rounded-xl bg-orange-500 text-white">
                    <HeadphonesIcon className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                  <CardTitle className="text-lg md:text-xl mb-2">
                    完整元数据
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base">
                    自动嵌入专辑封面和歌词
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm md:text-base">
                    下载的音乐文件自动包含专辑封面、歌词和完整的ID3标签信息
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
