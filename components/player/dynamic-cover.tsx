"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  initGlobalAudioAnalyser,
  getGlobalAudioIntensity,
  shouldContinueAudioResponse,
  isGlobalAnalyserInitialized,
  setShouldContinueAudioResponse,
  DEBUG_AUDIO,
} from "@/lib/audio/audio-analyzer";
import { injectPlayerStyles } from "@/lib/styles/player-animations";

// 确保样式只注入一次
if (typeof document !== "undefined" && typeof window !== "undefined") {
  injectPlayerStyles();
}

// 动态封面组件 - 完全独立，避免重新渲染
const DynamicCover = React.memo(
  ({
    src,
    alt,
    size,
    isPlaying,
    audioElement,
  }: {
    src?: string;
    alt: string;
    size: "small" | "large";
    isPlaying: boolean;
    audioElement?: HTMLAudioElement | null;
  }) => {
    const sizeClasses = size === "small" ? "w-10 h-10" : "w-12 h-12";
    const iconSize = size === "small" ? "h-4 w-4" : "h-6 w-6";

    const coverRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const isInitialized = useRef(false);
    const renderCount = useRef(0);
    const componentId = useRef(
      `cover-${size}-${Math.random().toString(36).substr(2, 9)}`
    );

    // 音频分析相关
    const audioAnalyserRef = useRef<AnalyserNode | null>(null);
    const audioDataRef = useRef<Uint8Array | null>(null);
    const animationRef = useRef<number | null>(null);

    // 添加一个调试元素引用，用于可视化音频数据
    const debugElementRef = useRef<HTMLDivElement | null>(null);

    // 呼吸效果状态引用
    const intensityRef = useRef(0.5);
    const lastUpdateTimeRef = useRef(0);
    const lastIntensityRef = useRef(0.5);

    // 基础呼吸频率（毫秒）
    const basePulseFrequency = 200;

    renderCount.current += 1;

    if (DEBUG_AUDIO) {
      // console.log(
      //   `🎨 DynamicCover[${componentId.current}] 渲染 #${renderCount.current}`,
      //   { size, isPlaying, isInitialized: isInitialized.current }
      // );
    }

    // 强制停止所有动画循环的辅助函数
    const forceStopAnimations = useCallback(() => {
      // console.log(`🛑 [${componentId.current}] 强制停止所有动画循环`);
      // 立即设置全局标志为false，确保所有回调都能读取到
      setShouldContinueAudioResponse(false);

      // 停止RAF循环
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // 隐藏发光元素
      if (glowRef.current) {
        glowRef.current.style.display = "none";
      }
    }, []);

    // 音频分析初始化 - 使用全局单例
    const initAudioAnalysis = useCallback(() => {
      if (typeof window === "undefined" || !audioElement) {
        // console.log("🎵 音频元素未就绪，等待下次初始化");
        return false;
      }

      // 只在size为large的组件中初始化全局分析器，避免重复初始化
      // 但小尺寸组件也可以使用全局分析器数据
      if (size === "large") {
        return initGlobalAudioAnalyser(audioElement);
      } else {
        // 小尺寸组件不初始化分析器，但标记为已准备好使用全局分析器
        return isGlobalAnalyserInitialized;
      }
    }, [audioElement, size]);

    // 直接操作DOM的音频响应循环，比setState更高效
    const updateAudioResponse = useCallback(() => {
      // 安全检查
      try {
        const now = Date.now();

        // 安全检查 - 如果循环应该停止了则不继续
        if (!shouldContinueAudioResponse || !isPlaying || !glowRef.current) {
          if (DEBUG_AUDIO) {
            // console.log(
            //   `⚠️ 响应循环停止: shouldContinue=${shouldContinueAudioResponse}, isPlaying=${isPlaying}`
            // );
          }
          return;
        }

        const timeDelta = now - lastUpdateTimeRef.current;

        // 限制更新频率以优化性能，约30fps
        if (timeDelta >= 33 || lastUpdateTimeRef.current === 0) {
          lastUpdateTimeRef.current = now;

          // 获取音频强度
          const currentIntensity = getGlobalAudioIntensity();

          // 添加小幅度的随机波动，使动画更自然
          const jitter = (Math.random() - 0.5) * 0.08; // 增加随机波动幅度

          // 自动振荡基础值 - 即使没有音频变化也会有呼吸效果
          const time = now / 1000; // 秒为单位
          const baseOscillation = Math.sin(time * 2) * 0.1 + 0.5; // 0.4-0.6的范围，增加基础呼吸幅度

          // 将音频强度与基础振荡混合 - 音频强度高时主导，低时辅助
          const blendFactor = Math.min(1, currentIntensity * 1.8); // 当强度>=0.56时完全由音频主导
          const combinedIntensity =
            currentIntensity * blendFactor +
            baseOscillation * (1 - blendFactor);

          // 指数平滑 - 使动画更流畅但保持对音频变化的敏感度
          // 变化越大，平滑系数越高，使得大的变化更快体现出来
          const delta = combinedIntensity - lastIntensityRef.current;
          // 提高平滑系数基础值，使响应速度更快
          const smoothingFactor = Math.min(0.4, 0.2 + Math.abs(delta) * 0.7);
          const smoothedIntensity =
            lastIntensityRef.current + delta * smoothingFactor + jitter;

          // 保存当前值作为下一帧的参考
          lastIntensityRef.current = smoothedIntensity;

          // 将音频强度直接映射到CSS变量，简化动画链路
          if (glowRef.current) {
            // 为大小尺寸选择不同的缩放范围
            // 小尺寸使用稍小的缩放范围，避免在手机上效果过于夸张
            const scale =
              size === "large"
                ? 0.8 + smoothedIntensity * 0.5 // 大尺寸: 0.8-1.3
                : 0.85 + smoothedIntensity * 0.4; // 小尺寸: 0.85-1.25

            // 计算动态发光强度，小尺寸略低以适应移动设备
            const glow =
              size === "large"
                ? 0.35 + smoothedIntensity * 0.65
                : 0.4 + smoothedIntensity * 0.6;

            // 直接应用样式变换，避免使用setState触发重新渲染
            glowRef.current.style.setProperty("--audio-intensity", `${glow}`);

            // 直接设置transform而不是通过CSS变量
            glowRef.current.style.transform = `scale(${scale.toFixed(4)})`;

            // 确保元素可见
            glowRef.current.style.display = "block";

            // 使用更明亮的紫色基础，增加亮度变化
            const baseBlue = 139 + Math.round(smoothedIntensity * 30); // 139-169的范围
            const baseSaturation = 92 + Math.round(smoothedIntensity * 40); // 92-132的范围

            // 调整阴影强度
            glowRef.current.style.boxShadow = `
              0 0 ${Math.round(
                15 * glow
              )}px rgba(${baseBlue}, ${baseSaturation}, 246, ${glow.toFixed(
              2
            )}),
              0 0 ${Math.round(
                30 * glow
              )}px rgba(${baseBlue}, ${baseSaturation}, 246, ${(
              glow * 0.7
            ).toFixed(2)}),
              0 0 ${Math.round(
                70 * glow
              )}px rgba(${baseBlue}, ${baseSaturation}, 246, ${(
              glow * 0.4
            ).toFixed(2)})
            `;

            // 调整边框颜色
            glowRef.current.style.borderColor = `rgba(${baseBlue}, ${baseSaturation}, 246, ${(
              0.7 +
              0.3 * glow
            ).toFixed(2)})`;

            // 设置明确的过渡效果，确保动画流畅
            glowRef.current.style.transition = "none";

            // 调整高光效果
            const highlightEl = coverRef.current?.querySelector(
              ".player-cover-highlight"
            );
            if (highlightEl) {
              (highlightEl as HTMLElement).style.opacity = `${
                0.3 + smoothedIntensity * 0.5 // 增加高光效果变化幅度
              }`;
            }
          }

          // 调试可视化 - 仅在开发模式和大尺寸封面时启用
          if (DEBUG_AUDIO && debugElementRef.current && size === "large") {
            const debugHeight = 50 * smoothedIntensity; // 0-50px高度表示音频强度
            debugElementRef.current.style.height = `${debugHeight}px`;
            debugElementRef.current.style.opacity = `${
              0.5 + smoothedIntensity * 0.5
            }`;
            // 颜色从蓝色到红色的渐变
            const hue = Math.round(240 - smoothedIntensity * 200); // 增大颜色变化范围
            debugElementRef.current.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
          }

          // 每30帧输出一次调试信息(约1秒)
          if (DEBUG_AUDIO && Math.random() < 0.03) {
            // 计算这些值仅用于日志输出
            const scale = 0.8 + smoothedIntensity * 0.5;
            const glow = 0.35 + smoothedIntensity * 0.65;

            // console.log(`🎵 [${size}] 音频响应:`, {
            //   raw: currentIntensity.toFixed(3),
            //   base: baseOscillation.toFixed(3),
            //   combined: combinedIntensity.toFixed(3),
            //   smoothed: smoothedIntensity.toFixed(3),
            //   scale: scale.toFixed(3),
            //   glow: glow.toFixed(3),
            // });
          }
        }

        // 使用requestAnimationFrame实现高效动画循环
        if (shouldContinueAudioResponse && isPlaying) {
          animationRef.current = requestAnimationFrame(updateAudioResponse);
        }
      } catch (error) {
        console.warn(`⚠️ 音频分析更新失败:`, error);

        // 出错时仍然继续尝试更新
        if (shouldContinueAudioResponse && isPlaying) {
          animationRef.current = requestAnimationFrame(updateAudioResponse);
        }
      }
    }, [isPlaying, size]);

    // 组件挂载时的一次性初始化
    useLayoutEffect(() => {
      if (!isInitialized.current && coverRef.current && glowRef.current) {
        // console.log(`✅ DynamicCover[${componentId.current}] 开始初始化`);

        // 初始化旋转动画
        coverRef.current.classList.add("player-cover-spinning");

        // 初始化发光效果
        glowRef.current.classList.add("player-cover-glow-ring");
        // 确保立即可见（如果正在播放）并设置初始样式
        if (isPlaying) {
          glowRef.current.style.display = "block";
          glowRef.current.style.transform = "scale(1)";
          glowRef.current.style.setProperty("--audio-intensity", "0.5");
        } else {
          glowRef.current.style.display = "none";
        }

        // 创建调试元素 - 仅在开发模式
        if (DEBUG_AUDIO && size === "large" && !debugElementRef.current) {
          const debugEl = document.createElement("div");
          debugEl.style.position = "absolute";
          debugEl.style.bottom = "0";
          debugEl.style.left = "50%";
          debugEl.style.width = "4px";
          debugEl.style.height = "0px";
          debugEl.style.backgroundColor = "blue";
          debugEl.style.transform = "translateX(-50%)";
          debugEl.style.transition = "height 0.1s ease";
          debugEl.style.zIndex = "100";
          debugEl.style.borderRadius = "2px 2px 0 0";
          debugEl.title = "音频强度可视化";

          // 添加到DOM
          glowRef.current.parentNode?.appendChild(debugEl);
          debugElementRef.current = debugEl;
        }

        // 根据初始播放状态设置动画
        if (isPlaying) {
          coverRef.current.classList.remove("player-cover-paused");
          glowRef.current.style.display = "block";

          // 检查音频元素是否就绪
          if (audioElement) {
            // console.log(`✅ 音频元素已就绪，开始初始化音频分析`);
            if (initAudioAnalysis()) {
              // 无论大小尺寸组件都启动响应循环
              setShouldContinueAudioResponse(true); // 确保全局标志为true
              // console.log(`🚀 [${componentId.current}] 启动响应循环`);
              updateAudioResponse();
            }
          } else {
            // console.log(`⏳ 等待音频元素传入...`);
          }
        } else {
          setShouldContinueAudioResponse(false); // 设置全局标志为false
          coverRef.current.classList.add("player-cover-paused");
          glowRef.current.style.display = "none";
        }

        isInitialized.current = true;
        // console.log(`🎯 DynamicCover[${componentId.current}] 初始化完成`);

        // 监听用户交互事件
        const handleUserInteraction = () => {
          // console.log(`👆 用户交互事件，尝试启动音频分析`);
          if (!audioAnalyserRef.current && isPlaying) {
            if (audioElement) {
              // console.log(`✅ 用户交互时音频元素已就绪`);
              if (initAudioAnalysis()) {
                // console.log(`🚀 [${componentId.current}] 用户交互启动响应循环`);
                setShouldContinueAudioResponse(true);
                updateAudioResponse();
              }
            } else {
              // console.log(`⏳ 用户交互时等待音频元素...`);
            }
          }
        };

        if (typeof window !== "undefined") {
          window.addEventListener(
            "user-interaction-play",
            handleUserInteraction
          );

          // 清理函数
          return () => {
            window.removeEventListener(
              "user-interaction-play",
              handleUserInteraction
            );
          };
        }
      }
    }, [initAudioAnalysis, updateAudioResponse, isPlaying, audioElement, size]);

    // 只监听播放状态变化，控制动画播放/暂停
    useLayoutEffect(() => {
      if (isInitialized.current && coverRef.current && glowRef.current) {
        if (isPlaying) {
          setShouldContinueAudioResponse(true); // 设置全局标志为true
          coverRef.current.classList.remove("player-cover-paused");
          glowRef.current.style.display = "block";

          // 启动音频分析
          if (!audioAnalyserRef.current) {
            if (audioElement) {
              // console.log(`✅ 播放状态变化时音频元素已就绪`);
              if (initAudioAnalysis()) {
                // 无论大小尺寸组件都启动响应循环
                // console.log(
                //   `🚀 [${componentId.current}] 播放状态变化启动响应循环`
                // );
                updateAudioResponse();
              }
            } else {
              // console.log(`⏳ 播放状态变化时等待音频元素...`);
            }
          } else {
            // 无论大小尺寸组件都启动响应循环
            // console.log(
            //   `🚀 [${componentId.current}] 已有分析器，重新启动响应循环`
            // );
            updateAudioResponse();
          }
        } else {
          setShouldContinueAudioResponse(false); // 设置全局标志为false
          coverRef.current.classList.add("player-cover-paused");
          glowRef.current.style.display = "none";

          // 停止音频分析
          if (animationRef.current) {
            // console.log(`⏹️ [${componentId.current}] 停止响应循环`);
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }

          // 额外确保完全停止所有动画循环
          forceStopAnimations();
        }
      }
    }, [
      isPlaying,
      initAudioAnalysis,
      updateAudioResponse,
      audioElement,
      size,
      forceStopAnimations,
    ]);

    // 组件卸载时清理
    useEffect(() => {
      return () => {
        // 重置全局控制变量
        if (size === "large") {
          setShouldContinueAudioResponse(false);
        }

        // 停止RAF循环
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }

        // 移除调试元素
        if (debugElementRef.current) {
          debugElementRef.current.remove();
          debugElementRef.current = null;
        }

        // console.log(
        //   `🗑️ DynamicCover[${componentId.current}] 组件卸载，清理资源`
        // );
      };
    }, [size, componentId]);

    // 监听歌曲变化
    useEffect(() => {
      // 当src变化时，意味着歌曲已经改变
      if (src) {
        // console.log(`🎵 检测到歌曲变化: ${src}`);
        // 重置全局分析器，确保在新歌曲开始时重新初始化
        // 此处应该引入resetGlobalAudioAnalyser函数，但因为组件已重构，不再直接调用

        // 如果正在播放，重新启动音频分析
        if (isPlaying && audioElement) {
          // console.log(`🔄 歌曲变化时重新初始化音频分析`);
          if (initAudioAnalysis()) {
            // console.log(`🚀 [${componentId.current}] 歌曲变化启动响应循环`);
            setShouldContinueAudioResponse(true);
            updateAudioResponse();
          }
        }
      }
    }, [src, isPlaying, audioElement, initAudioAnalysis, updateAudioResponse]);

    return (
      <div className={cn("relative", sizeClasses)}>
        {/* 圆形封面容器 */}
        <div
          ref={coverRef}
          className={cn("player-cover-container", sizeClasses)}
        >
          {src ? (
            <img src={src} alt={alt} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Play className={cn("text-muted-foreground", iconSize)} />
            </div>
          )}
        </div>

        {/* 发光Ring - 音频响应 */}
        <div
          ref={glowRef}
          className="player-cover-glow-ring"
          style={{ display: "none" }}
        />

        {/* 内部高光效果 */}
        {isPlaying && <div className="player-cover-highlight" />}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较函数，减少重新渲染
    return (
      prevProps.src === nextProps.src &&
      prevProps.alt === nextProps.alt &&
      prevProps.size === nextProps.size &&
      prevProps.isPlaying === nextProps.isPlaying
    );
  }
);

export { DynamicCover };
