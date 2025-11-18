import { context } from "./context";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { withEnqueue, enqueue } from "../utils";

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  // 1. 훅 컨텍스트 초기화: visited 초기화 (렌더링마다 방문 추적 리셋)
  context.hooks.visited.clear();

  // 2. reconcile 호출: 루트부터 재조정 시작
  if (context.root.container && context.root.node) {
    context.root.instance = reconcile(context.root.container, context.root.instance, context.root.node);
  }

  // 3. 사용하지 않은 훅 정리
  cleanupUnusedHooks();

  // 4. effect 큐 비동기 실행
  const effectsToRun = [...context.effects.queue];
  context.effects.queue = [];

  if (effectsToRun.length > 0) {
    enqueue(() => {
      effectsToRun.forEach(({ path, cursor }) => {
        const hooks = context.hooks.state.get(path);
        if (!hooks) return;

        const effectHook = hooks[cursor];
        if (!effectHook || effectHook.kind !== "effect") return;

        // 이전 cleanup 실행
        if (effectHook.cleanup) {
          effectHook.cleanup();
        }

        // effect 실행하고 새 cleanup 저장
        const cleanup = effectHook.effect();
        effectHook.cleanup = cleanup || null;
      });
    });
  }
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
