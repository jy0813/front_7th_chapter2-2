/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmptyValue, isVNode } from "../utils";
import { VNode } from "./types";
import { Fragment, TEXT_ELEMENT } from "./constants";

/**
 * 주어진 노드를 VNode 형식으로 정규화합니다.
 * null, undefined, boolean, 배열, 원시 타입 등을 처리하여 일관된 VNode 구조를 보장합니다.
 */
export const normalizeNode = (node: VNode): VNode | null => {
  // 여기를 구현하세요.
  // 렌더러가 이해할 수 없는 값 제거 함수 호출
  if (isEmptyValue(node)) return null;
  // 원시 값(string, number)을 VNode로 변환
  // createTextElement 호출해야함.
  if (typeof node === "string" || typeof node === "number") {
    return createTextElement(node);
  }
  // 이미 VNode인 경우 그대로 반환
  if (isVNode(node)) {
    return node;
  }
  return null;
};

/**
 * 텍스트 노드를 위한 VNode를 생성합니다.
 */
// 매개변수 타입 불일치 수정 => VNode 를 string | number 로 변경
const createTextElement = (node: string | number): VNode => {
  // 여기를 구현하세요.
  return {
    type: TEXT_ELEMENT,
    key: null,
    props: {
      nodeValue: String(node),
      children: [],
    },
  };
};

/**
 * JSX로부터 전달된 인자를 VNode 객체로 변환합니다.
 * 이 함수는 JSX 변환기에 의해 호출됩니다. (예: Babel, TypeScript)
 */
export const createElement = (
  type: string | symbol | React.ComponentType<any>,
  originProps?: Record<string, any> | null,
  ...rawChildren: any[]
) => {
  // 여기를 구현하세요.
  // 1. props와 key 분리
  const { key = null, ...restProps } = originProps || {};
  const props: Record<string, any> = { ...restProps };

  // 2. children 평탄화
  const flatChildren = rawChildren.flat(Infinity);
  const children: VNode[] = [];

  // 3. children 정규화
  for (const child of flatChildren) {
    const normalized = normalizeNode(child);
    if (normalized) children.push(normalized);
  }

  // 4. children이 있으면 추가
  if (children.length) props.children = children;

  // 5. VNode 반환
  return { type, key, props };
};

/**
 * 부모 경로와 자식의 key/index를 기반으로 고유한 경로를 생성합니다.
 * 이는 훅의 상태를 유지하고 Reconciliation에서 컴포넌트를 식별하는 데 사용됩니다.
 */
export const createChildPath = (
  parentPath: string,
  key: string | null,
  index: number,
  nodeType?: string | symbol | React.ComponentType,
  siblings?: VNode[],
): string => {
  // 여기를 구현하세요.
  let childId: string;

  // Key 우선 (중복 검사)
  if (key !== null && key !== "") {
    const isDuplicate = siblings?.some((s, i) => i < index && s.key === key);
    childId = isDuplicate ? String(index) : key;
  }
  // NodeType 기반 인덱싱
  else if (nodeType && siblings) {
    // 같은 타입의 형제 중 몇 번째인지
    const sameTypeIndex = siblings.slice(0, index).filter((s) => s.type === nodeType).length;

    // 타입 접두사 생성
    let prefix = "";
    if (nodeType === Fragment) prefix = "f";
    else if (nodeType === TEXT_ELEMENT) prefix = "t";
    else if (typeof nodeType === "string") prefix = "h";
    else if (typeof nodeType === "function") {
      // 함수 컴포넌트의 경우 함수 이름 포함하여 구분
      const functionName = nodeType.name || "anonymous";
      prefix = `c${functionName}`;
    } else prefix = "c";

    childId = `${prefix}_${sameTypeIndex}`;
  }
  // 폴백: 단순 index
  else {
    childId = String(index);
  }

  return parentPath ? `${parentPath}/${childId}` : childId;
};
