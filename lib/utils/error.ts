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
