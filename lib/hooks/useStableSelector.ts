import { shallow } from "zustand/shallow";

/**
 * 为 zustand store 提供统一稳定 selector，默认使用 shallow compare。
 */
export function useStableSelector<T extends object, S>(
  store: {
    (selector: (state: T) => S, equalityFn?: (a: S, b: S) => boolean): S;
    getState: () => T;
    subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  },
  selector: (state: T) => S
): S {
  // 直接调用 store hook，并使用 shallow 比较，确保稳定引用
   
  return store(selector, shallow);
}
