import { VNode } from "../core/types";

/**
 * VNode가 렌더링되지 않아야 하는 값인지 확인합니다.
 * (예: null, undefined, boolean)
 *
 * @param value - 확인할 값
 * @returns 렌더링되지 않아야 하면 true, 그렇지 않으면 false
 */
export const isEmptyValue = (value: unknown): boolean => {
  // 여기를 구현하세요.
  // 렌더러가 이해할 수 없는 값 제거 (null, undefined, boolean) 해야함.
  // normalizeNode 를 호출하는 쪽에서 사용됨.
  return value === null || value === undefined || typeof value === "boolean";
};

// 타입가드 함수
/**
 * 주어진 값이 VNode인지 확인합니다.
 * @param value - 확인할 값
 * @returns VNode이면 true, 그렇지 않으면 false
 */
export const isVNode = (value: unknown): value is VNode => {
  return value !== null && typeof value === "object" && "type" in value && "props" in value && "key" in value;
};
