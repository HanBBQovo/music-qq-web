// 全局音频分析单例管理
let globalAudioAnalyser: AnalyserNode | null = null;
let globalAudioContext: AudioContext | null = null;
let globalAudioData: Uint8Array | null = null;
let isGlobalAnalyserInitialized = false;
// 添加一个全局变量来跟踪是否应该继续响应循环
let shouldContinueAudioResponse = false;
// 调试模式 - 在控制台输出更多日志
const DEBUG_AUDIO = false;

export const initGlobalAudioAnalyser = (
  audioElement: HTMLAudioElement
): boolean => {
  if (isGlobalAnalyserInitialized && globalAudioAnalyser && globalAudioData) {
    // console.log("🎤 使用已初始化的全局音频分析器");

    // 重要：检查并确保音频元素连接是最新的
    if ((audioElement as any).globalAudioContextSource) {
      // console.log("🔍 检测到已有音频源连接，正在验证...");

      // 检查当前音频源是否与此音频元素关联
      if (
        (audioElement as any).globalAudioContextSource.mediaElement !==
        audioElement
      ) {
        // console.log("⚠️ 检测到音频元素已变更，重新建立连接");

        // 断开旧连接
        (audioElement as any).globalAudioContextSource.disconnect();
        delete (audioElement as any).globalAudioContextSource;

        // 创建新连接
        if (globalAudioContext && globalAudioAnalyser) {
          const newSource =
            globalAudioContext.createMediaElementSource(audioElement);
          newSource.connect(globalAudioAnalyser);
          (audioElement as any).globalAudioContextSource = newSource;
          // console.log("✅ 已为新音频元素重建连接");
        }
      } else {
        // console.log("✅ 音频源连接验证通过，使用现有连接");
      }
    }

    return true;
  }

  try {
    // console.log("🎤 初始化全局音频分析器:", audioElement.src);
    // console.log("🎤 音频元素状态:", {
    //   paused: audioElement.paused,
    //   currentTime: audioElement.currentTime,
    //   duration: audioElement.duration,
    //   readyState: audioElement.readyState,
    //   crossOrigin: audioElement.crossOrigin,
    // });

    // 创建全局音频上下文和分析器
    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      // console.log("🎼 全局音频上下文状态:", globalAudioContext.state);
    }

    // 如果音频上下文被暂停，尝试恢复
    if (globalAudioContext.state === "suspended") {
      // console.log("🔄 全局音频上下文被暂停，尝试恢复...");
      globalAudioContext
        .resume()
        .then(() => {
          // console.log("✅ 全局音频上下文已恢复");
        })
        .catch((err) => {
          console.warn("⚠️ 恢复全局音频上下文失败:", err);
        });
    }

    if (!globalAudioAnalyser) {
      globalAudioAnalyser = globalAudioContext.createAnalyser();
      // 增大FFT大小，获取更详细的频率数据
      globalAudioAnalyser.fftSize = 128; // 从64提高到128，获取更精细的频谱
      // 降低平滑常量，使其对变化更敏感
      globalAudioAnalyser.smoothingTimeConstant = 0.65; // 从0.8降低到0.65

      // console.log("📊 全局分析器设置:", {
      //   fftSize: globalAudioAnalyser.fftSize,
      //   frequencyBinCount: globalAudioAnalyser.frequencyBinCount,
      //   smoothingTimeConstant: globalAudioAnalyser.smoothingTimeConstant,
      // });

      // 连接音频源
      if (!(audioElement as any).globalAudioContextSource) {
        // console.log("🔗 创建全局音频源连接");
        const source =
          globalAudioContext.createMediaElementSource(audioElement);
        source.connect(globalAudioAnalyser);
        globalAudioAnalyser.connect(globalAudioContext.destination);

        // 保存引用，避免重复创建
        (audioElement as any).globalAudioContextSource = source;
      } else {
        // console.log("🔗 使用已存在的全局音频源");
        const existingSource = (audioElement as any).globalAudioContextSource;
        existingSource.connect(globalAudioAnalyser);
        globalAudioAnalyser.connect(globalAudioContext.destination);
      }

      globalAudioData = new Uint8Array(globalAudioAnalyser.frequencyBinCount);
    }

    isGlobalAnalyserInitialized = true;
    // console.log("🎼 全局音频分析器初始化成功");

    // 立即测试是否能获取数据
    setTimeout(() => {
      if (globalAudioAnalyser && globalAudioData) {
        globalAudioAnalyser.getByteFrequencyData(globalAudioData);
        const testSum = globalAudioData.reduce((sum, value) => sum + value, 0);
        // console.log("🧪 全局音频数据测试:", {
        //   dataArray: Array.from(globalAudioData.slice(0, 8)),
        //   sum: testSum,
        //   hasData: testSum > 0,
        //   audioPlaying: !audioElement.paused,
        //   audioContext: globalAudioContext?.state,
        // });

        if (testSum === 0 && !audioElement.paused) {
          console.warn("⚠️ 音频正在播放但未检测到音频数据，可能是跨域问题");
        }
      }
    }, 2000);

    return true;
  } catch (error) {
    console.error("❌ 全局音频分析器初始化失败:", error);

    if (error instanceof DOMException) {
      console.error("🚫 DOM异常:", error.name, error.message);
      if (error.name === "NotAllowedError") {
        console.error("🔒 可能是跨域问题或需要用户交互才能访问音频");
      } else if (error.name === "InvalidStateError") {
        console.error("🔄 音频上下文状态无效，可能需要用户交互");
      } else if (error.name === "InvalidAccessError") {
        console.error("🔀 音频节点连接冲突，可能已有其他连接");
      }
    }

    return false;
  }
};

// 获取全局音频强度数据 - 优化检测节奏的算法
export const getGlobalAudioIntensity = (): number => {
  if (!globalAudioAnalyser || !globalAudioData) {
    return 0.5; // 默认强度
  }

  try {
    globalAudioAnalyser.getByteFrequencyData(globalAudioData);

    // 主要关注低频区域，这里包含了鼓点和贝斯的大部分能量
    const totalBins = globalAudioData.length;

    // 专注于最低频段，通常包含鼓点和贝斯
    const bassFreqData = globalAudioData.slice(0, Math.floor(totalBins * 0.12));

    // 低中频区域，包含更多节奏元素
    const lowMidFreqData = globalAudioData.slice(
      Math.floor(totalBins * 0.12),
      Math.floor(totalBins * 0.35)
    );

    // 中高频区域，包含人声和其他乐器
    const midHighFreqData = globalAudioData.slice(
      Math.floor(totalBins * 0.35),
      Math.floor(totalBins * 0.65)
    );

    // 计算平均值
    const bassAvg =
      bassFreqData.reduce((sum, value) => sum + value, 0) / bassFreqData.length;
    const lowMidAvg =
      lowMidFreqData.reduce((sum, value) => sum + value, 0) /
      lowMidFreqData.length;
    const midHighAvg =
      midHighFreqData.reduce((sum, value) => sum + value, 0) /
      midHighFreqData.length;

    // 找到低频中的最大值，更好地捕捉鼓点（不使用展开语法，避免TypeScript错误）
    let bassMax = 0;
    for (let i = 0; i < bassFreqData.length; i++) {
      if (bassFreqData[i] > bassMax) {
        bassMax = bassFreqData[i];
      }
    }

    // 计算音频强度 - 降低强度值，使其不轻易达到最大值
    // 将255调整为300，减小整体音频强度值
    const rawIntensity = Math.min(
      (bassAvg * 0.4 +
        lowMidAvg * 0.3 +
        midHighAvg * 0.1 +
        (bassMax / 300) * 0.2) /
        1,
      1
    );

    // 强度映射 - 使用更强的非线性映射，以获得更明显的动态效果
    // 调整幂指数从0.5提高到0.65，使低强度时变化更小，高强度时变化更大
    // 降低基础值和范围，使变化更加分散
    const enhancedIntensity = Math.pow(rawIntensity, 0.65) * 0.75 + 0.15;

    // 动态脉冲计算：当检测到强度突然增加时，产生额外的脉冲效应
    // 持续改进的方式是在audio-analyzer层面实现，而非仅在视觉层面

    // 调试输出
    if (DEBUG_AUDIO && Math.random() < 0.03) {
      // console.log("🎵 音频强度:", {
      //   raw: rawIntensity.toFixed(3),
      //   enhanced: enhancedIntensity.toFixed(3),
      //   bassAvg: (bassAvg / 255).toFixed(3),
      //   lowMidAvg: (lowMidAvg / 255).toFixed(3),
      //   midHighAvg: (midHighAvg / 255).toFixed(3),
      //   bassMax: (bassMax / 255).toFixed(3),
      //   bass: Array.from(bassFreqData.slice(0, 3)).map((v) =>
      //     (v / 255).toFixed(2)
      //   ),
      // });
    }

    return enhancedIntensity;
  } catch (error) {
    console.warn("⚠️ 获取全局音频强度失败:", error);
    return 0.5;
  }
};

// 重置全局音频分析器
export const resetGlobalAudioAnalyser = (): void => {
  // console.log("🔄 重置全局音频分析器");
  isGlobalAnalyserInitialized = false;
  if (globalAudioAnalyser) {
    try {
      globalAudioAnalyser.disconnect();
    } catch (error) {
      console.warn("⚠️ 断开全局音频分析器时出错:", error);
    }
    globalAudioAnalyser = null;
  }
  globalAudioData = null;
};

// 导出全局控制状态变量
export {
  shouldContinueAudioResponse,
  isGlobalAnalyserInitialized,
  DEBUG_AUDIO,
};

// 设置全局音频响应循环的状态
export const setShouldContinueAudioResponse = (value: boolean): void => {
  shouldContinueAudioResponse = value;
};
