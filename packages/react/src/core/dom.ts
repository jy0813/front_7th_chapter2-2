/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeType, NodeTypes } from "./constants";
import { Instance } from "./types";

console.log(NodeTypes);

const test: NodeType = NodeTypes.HOST;

console.log(test);

/**
 * DOM 요소에 속성(props)을 설정합니다.
 * 이벤트 핸들러, 스타일, className 등 다양한 속성을 처리해야 합니다.
 */
export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  Object.entries(props).forEach(([key, value]) => {
    // 1. children, nodeValue 무시
    if (key === "children" || key === "nodeValue") return;

    // 2. style 객체 처리
    if (key === "style" && value && typeof value === "object") {
      Object.entries(value).forEach(([styleName, styleValue]) => {
        (dom.style as any)[styleName] = styleValue != null ? String(styleValue) : "";
      });
      return;
    }

    // 3. 이벤트 핸들러 처리
    if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();
      dom.addEventListener(eventName, value);
      return;
    }

    // 4. className 처리
    if (key === "className") {
      dom.className = value ?? "";
      return;
    }

    // 5. data-* 속성 처리
    if (key.startsWith("data-")) {
      if (value != null) dom.setAttribute(key, String(value));
      return;
    }

    // 6. boolean 속성 처리
    if (typeof value === "boolean") {
      if (key in dom) {
        (dom as any)[key] = value;
      } else if (value) {
        dom.setAttribute(key, "");
      }
      return;
    }

    // 7. null/undefined 무시
    if (value == null) return;

    // 8. 일반 속성 처리 (프로퍼티 우선, 없으면 setAttribute)
    if (key in dom) {
      (dom as any)[key] = value;
    } else {
      dom.setAttribute(key, String(value));
    }
  });
};

/**
 * 이전 속성과 새로운 속성을 비교하여 DOM 요소의 속성을 업데이트합니다.
 * 변경된 속성만 효율적으로 DOM에 반영해야 합니다.
 */
export const updateDomProps = (
  dom: HTMLElement,
  prevProps: Record<string, any> = {},
  nextProps: Record<string, any> = {},
): void => {
  // 제거되거나 변경된 속성 처리
  Object.entries(prevProps).forEach(([key, prevValue]) => {
    // children과 style은 별도 처리
    if (key === "children" || key === "style") return;

    const nextValue = nextProps[key];
    const hasNext = Object.prototype.hasOwnProperty.call(nextProps, key);
    const isUnchanged = hasNext && nextValue === prevValue;

    // 값이 동일하면 스킵
    if (isUnchanged) return;

    // 이벤트 핸들러 제거
    if (key.startsWith("on") && typeof prevValue === "function") {
      const eventName = key.slice(2).toLowerCase();
      dom.removeEventListener(eventName, prevValue);
      return;
    }

    // className 처리 (제거 또는 업데이트)
    if (key === "className") {
      dom.className = hasNext ? (nextValue ?? "") : "";
      return;
    }

    // data-* 속성 제거
    if (key.startsWith("data-")) {
      if (!hasNext || nextValue == null) {
        dom.removeAttribute(key);
      }
      return;
    }

    // boolean 속성 제거
    if (!hasNext && typeof prevValue === "boolean") {
      if (key in dom) {
        (dom as any)[key] = false;
      }
      dom.removeAttribute(key);
      return;
    }

    // 일반 속성 제거
    if (!hasNext) {
      // 프로퍼티가 있으면 초기화 시도
      if (key in dom) {
        try {
          (dom as any)[key] = "";
        } catch {
          // 읽기 전용 프로퍼티(innerHTML, tagName 등)는 무시
        }
      }
      // attribute 제거
      dom.removeAttribute(key);
    }
  });

  // style 개별 속성 업데이트

  const prevStyle = prevProps.style ?? {};
  const nextStyle = nextProps.style ?? {};
  const allStyleKeys = new Set([...Object.keys(prevStyle), ...Object.keys(nextStyle)]);

  allStyleKeys.forEach((styleName) => {
    const prevVal = prevStyle[styleName];
    const nextVal = nextStyle[styleName];

    // 값이 동일하면 스킵
    if (prevVal === nextVal) return;

    // 변경된 스타일만 업데이트
    (dom.style as any)[styleName] = nextVal != null ? String(nextVal) : "";
  });

  // 추가되거나 변경된 속성 설정

  Object.entries(nextProps).forEach(([key, value]) => {
    // children과 style은 이미 처리했거나 별도 처리
    if (key === "children" || key === "style") return;

    const prevValue = prevProps[key];
    const isUnchanged = value === prevValue;

    // 이벤트 핸들러 추가/교체
    if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();

      // 이전 핸들러가 다르면 제거
      if (typeof prevValue === "function" && prevValue !== value) {
        dom.removeEventListener(eventName, prevValue);
      }

      // 새 핸들러 등록
      dom.addEventListener(eventName, value);
      return;
    }

    // className 설정
    if (key === "className") {
      if (!isUnchanged) {
        dom.className = value ?? "";
      }
      return;
    }

    // data-* 속성 설정
    if (key.startsWith("data-")) {
      if (value == null) {
        dom.removeAttribute(key);
      } else if (!isUnchanged) {
        dom.setAttribute(key, String(value));
      }
      return;
    }

    // boolean 속성 설정
    if (typeof value === "boolean") {
      if (key in dom) {
        // DOM 프로퍼티로 설정
        if (!isUnchanged) {
          (dom as any)[key] = value;
        }
      } else {
        // attribute로 설정
        if (value) {
          dom.setAttribute(key, "");
        } else {
          dom.removeAttribute(key);
        }
      }
      return;
    }

    // null/undefined는 제거 처리 (이미 STEP 1에서 처리됨)
    if (value == null || isUnchanged) return;

    // 일반 속성 설정 (프로퍼티 우선, 없으면 attribute)
    if (key in dom) {
      (dom as any)[key] = value;
    } else {
      dom.setAttribute(key, String(value));
    }
  });
};

/**
 * 주어진 인스턴스에서 실제 DOM 노드(들)를 재귀적으로 찾아 배열로 반환합니다.
 * Fragment나 컴포넌트 인스턴스는 여러 개의 DOM 노드를 가질 수 있습니다.
 */
export const getDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  // 여기를 구현하세요.

  console.log(instance);

  return [];
};

/**
 * 주어진 인스턴스에서 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDom = (instance: Instance | null): HTMLElement | Text | null => {
  // 여기를 구현하세요.
  console.log(instance);
  return null;
};

/**
 * 자식 인스턴스들로부터 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDomFromChildren = (children: (Instance | null)[]): HTMLElement | Text | null => {
  // 여기를 구현하세요.
  console.log(children);
  return null;
};

/**
 * 인스턴스를 부모 DOM에 삽입합니다.
 * anchor 노드가 주어지면 그 앞에 삽입하여 순서를 보장합니다.
 */
export const insertInstance = (
  parentDom: HTMLElement,
  instance: Instance | null,
  anchor: HTMLElement | Text | null = null,
): void => {
  // 여기를 구현하세요.

  console.log(parentDom, instance, anchor);
};

/**
 * 부모 DOM에서 인스턴스에 해당하는 모든 DOM 노드를 제거합니다.
 */
export const removeInstance = (parentDom: HTMLElement, instance: Instance | null): void => {
  // 여기를 구현하세요.
  console.log(parentDom, instance);
};
