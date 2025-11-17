/**
 * 두 값의 얕은 동등성을 비교합니다.
 * 객체와 배열은 1단계 깊이까지만 비교합니다.
 */
export const shallowEquals = (a: unknown, b: unknown): boolean => {
  // 여기를 구현하세요.
  // Object.is(), Array.isArray(), Object.keys() 등을 활용하여 1단계 깊이의 비교를 구현합니다.
  // 1. Object.is()로 기본 타입과 참조 동일성 체크
  if (Object.is(a, b)) {
    return true;
  }

  // 2. 둘 중 하나라도 null이거나 객체가 아니면 false
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  // 3. 배열 비교
  if (Array.isArray(a) && Array.isArray(b)) {
    // 길이가 다르면 false
    if (a.length !== b.length) {
      return false;
    }

    // 각 요소를 Object.is()로 비교 (얕은 비교)
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  // 4. 배열 타입 불일치
  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  // 5. 객체 비교
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  // 키 개수가 다르면 false
  if (keysA.length !== keysB.length) {
    return false;
  }

  // 모든 키와 값을 Object.is()로 비교 (얕은 비교)
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }

  return true;
};

/**
 * 두 값의 깊은 동등성을 비교합니다.
 * 객체와 배열의 모든 중첩된 속성을 재귀적으로 비교합니다.
 */
export const deepEquals = (a: unknown, b: unknown): boolean => {
  // 여기를 구현하세요.
  // 재귀적으로 deepEquals를 호출하여 중첩된 구조를 비교해야 합니다.
  // 1. Object.is()로 기본 타입과 참조 동일성 체크
  if (Object.is(a, b)) {
    return true;
  }

  // 2. 둘 중 하나라도 null이거나 객체가 아니면 false
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  // 3. 배열 비교
  if (Array.isArray(a) && Array.isArray(b)) {
    // 길이가 다르면 false
    if (a.length !== b.length) {
      return false;
    }

    // 각 요소를 재귀적으로 deepEquals 호출 (깊은 비교)
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  // 4. 배열 타입 불일치
  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  // 5. 객체 비교
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  // 키 개수가 다르면 false
  if (keysA.length !== keysB.length) {
    return false;
  }

  // 모든 키와 값을 재귀적으로 deepEquals 호출 (깊은 비교)
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !deepEquals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }

  return true;
};
