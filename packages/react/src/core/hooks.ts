import { shallowEquals } from "../utils";
import { context } from "./context";
import { EffectHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 */
export const cleanupUnusedHooks = () => {
  // visited Set에 없는 경로는 이번 렌더링에서 사용되지 않음
  const allPaths = Array.from(context.hooks.state.keys());

  allPaths.forEach((path) => {
    if (!context.hooks.visited.has(path)) {
      // 해당 경로의 Hook에서 cleanup 함수 실행
      const hooks = context.hooks.state.get(path) ?? [];

      hooks.forEach((hook) => {
        if (hook && hook.kind === HookTypes.EFFECT && hook.cleanup) {
          hook.cleanup();
        }
      });

      // state와 cursor에서 제거
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  });
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 1. 현재 컴포넌트의 경로와 커서 가져오기
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;

  // 2. 현재 컴포넌트의 Hook 배열 가져오기
  let hooks = context.hooks.state.get(path);
  if (!hooks) {
    hooks = [];
    context.hooks.state.set(path, hooks);
  }

  // 3. 현재 Hook 가져오기 또는 초기화
  if (hooks[cursor] === undefined) {
    // 첫 렌더링: 초기값 설정
    const value = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    hooks[cursor] = value;
  }

  const currentValue = hooks[cursor] as T;

  // 4. setState 함수 생성
  const setState = (nextValue: T | ((prev: T) => T)) => {
    // 함수형 업데이트 처리 시 항상 최신 값을 사용
    const latestValue = hooks![cursor] as T;
    const newValue = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(latestValue) : nextValue;

    // 값이 변경되었는지 확인 (Object.is)
    if (!Object.is(latestValue, newValue)) {
      hooks![cursor] = newValue;
      // 재렌더링 예약
      enqueueRender();
    }
  };

  // 5. 커서 증가
  context.hooks.cursor.set(path, cursor + 1);

  // 6. [state, setState] 반환
  return [currentValue, setState];
};

/**
 * 컴포넌트의 사이드 이펙트를 처리하기 위한 훅입니다.
 * @param effect - 실행할 이펙트 함수. 클린업 함수를 반환할 수 있습니다.
 * @param deps - 의존성 배열. 이 값들이 변경될 때만 이펙트가 다시 실행됩니다.
 */
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  // 1. 현재 컴포넌트의 경로와 커서 가져오기
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;

  // 2. 현재 컴포넌트의 Hook 배열 가져오기
  let hooks = context.hooks.state.get(path);
  if (!hooks) {
    hooks = [];
    context.hooks.state.set(path, hooks);
  }

  // 3. 이전 EffectHook 가져오기
  const prevHook = hooks[cursor] as EffectHook | undefined;

  // 4. deps가 변경되었는지 확인
  // deps가 undefined이면 매 렌더링마다 실행
  const depsChanged = !prevHook || deps === undefined || !shallowEquals(prevHook.deps, deps);

  // 5. deps가 변경되었으면 이펙트 실행 예약
  if (depsChanged) {
    // 이펙트 실행 정보를 큐에 추가
    context.effects.queue.push({
      path,
      cursor,
    });
  }

  // 6. 현재 EffectHook 저장
  hooks[cursor] = {
    kind: HookTypes.EFFECT,
    deps: deps ? [...deps] : null,
    cleanup: prevHook?.cleanup ?? null,
    effect,
  };

  // 7. 커서 증가
  context.hooks.cursor.set(path, cursor + 1);
};
