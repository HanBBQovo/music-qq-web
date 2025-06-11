// 播放器的动态CSS样式
const dynamicStyles = `
  .player-cover-container {
    position: relative;
    border-radius: 50%;
    overflow: hidden;
  }

  .player-cover-spinning {
    animation: player-spin 8s linear infinite;
    transform-origin: center center;
  }

  .player-cover-paused {
    animation-play-state: paused !important;
  }

  .player-cover-glow-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid rgba(139, 92, 246, 0.75);
    box-shadow: 
      0 0 20px rgba(139, 92, 246, var(--audio-intensity, 0.7)),
      0 0 35px rgba(139, 92, 246, calc(var(--audio-intensity, 0.7) * 0.65)),
      0 0 55px rgba(139, 92, 246, calc(var(--audio-intensity, 0.7) * 0.4)),
      inset 0 0 20px rgba(139, 92, 246, calc(var(--audio-intensity, 0.7) * 0.25));
    border-color: rgba(139, 92, 246, calc(0.75 + 0.25 * var(--audio-intensity, 0.7)));
    pointer-events: none;
    z-index: 10;
    will-change: transform, opacity, box-shadow, border-color;
    transform-origin: center center;
    transition: transform 0.05s ease-out;
  }

  .player-cover-highlight {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, transparent 55%);
    pointer-events: none;
    opacity: var(--highlight-opacity, 0.6);
    transition: opacity 0.1s ease;
  }

  @keyframes player-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* 音频响应效果变量 */
  :root {
    --audio-intensity: 0.7;
    --highlight-opacity: 0.6;
  }
`;

// 在客户端注入样式的函数
export function injectPlayerStyles(): void {
  if (typeof document !== "undefined" && typeof window !== "undefined") {
    const existingStyle = document.getElementById("player-dynamic-styles");
    if (!existingStyle) {
      const styleElement = document.createElement("style");
      styleElement.id = "player-dynamic-styles";
      styleElement.textContent = dynamicStyles;
      document.head.appendChild(styleElement);
      // console.log("🎨 播放器动画样式已注入");
    }
  }
}

// 导出样式字符串，以便直接使用
export { dynamicStyles };
