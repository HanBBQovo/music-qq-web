import { toast } from "sonner";

/**
 * 一个通用的错误处理包装器，用于API调用。
 * 捕获异常，记录错误，显示toast通知，并允许自定义成功/失败回调。
 */

interface ErrorHandlingOptions<T> {
  /** 要执行的异步API调用函数 */
  apiCall: () => Promise<T>;

  /** API调用成功时的回调函数 */
  onSuccess?: (result: T) => void;

  /** API调用失败时的回调函数，用于执行状态重置等操作 */
  onError?: (error: Error) => void;

  /** 显示在toast中的错误标题 */
  errorMessage: string;

  /** 是否显示错误toast，默认为true */
  showToast?: boolean;
}

export async function withErrorHandling<T>(
  options: ErrorHandlingOptions<T>
): Promise<T | null> {
  const {
    apiCall,
    onSuccess,
    onError,
    errorMessage,
    showToast = true,
  } = options;

  try {
    const result = await apiCall();
    onSuccess?.(result);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    console.error(`[API Error] ${errorMessage}:`, err);

    if (showToast) {
      toast.error(errorMessage, {
        description: err.message,
      });
    }

    onError?.(err);

    return null;
  }
}

/**
 * 从 API 错误对象中智能提取最具体、对用户最友好的错误消息。
 * @param error - 捕获到的异常对象，可以是任何类型。
 * @returns {string} - 提取出的错误消息字符串。
 */
export const extractApiErrorMessage = (error: any): string => {
  // 1. 检查 Axios 风格的错误：error.response.data.message
  // 这是最理想的情况，后端直接在 data.message 中提供了友好的错误提示
  if (
    error?.response?.data?.message &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  // 2. 检查 error.response.data 是否为字符串
  // 有些后端可能直接在 data 中返回字符串错误
  if (error?.response?.data && typeof error.response.data === "string") {
    return error.response.data;
  }

  // 3. 检查 fetch API 在 response.ok 为 false 时，我们自己抛出的错误
  // 或者其他地方直接抛出的 Error 对象
  if (error?.message && typeof error.message === "string") {
    // 避免显示通用的网络错误，提供更友好的提示
    if (error.message.toLowerCase().includes("network error")) {
      return "网络连接错误，请检查您的网络连接后再试。";
    }
    if (error.message.toLowerCase().includes("failed to fetch")) {
      return "网络请求失败，请检查您的网络连接或服务端状态。";
    }
    return error.message;
  }

  // 4. 如果错误是一个字符串
  if (typeof error === "string") {
    return error;
  }

  // 5. 最后的备用方案
  // 如果无法解析，返回一个通用的错误消息
  return "发生未知错误，请稍后重试或联系技术支持。";
};
