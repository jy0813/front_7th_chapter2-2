import { context } from "./context";
import { Fragment, NodeTypes, TEXT_ELEMENT } from "./constants";
import { Instance, VNode } from "./types";
import { getDomNodes, getFirstDom, insertInstance, removeInstance, setDomProps, updateDomProps } from "./dom";
import { createChildPath } from "./elements";
import { isEmptyValue } from "../utils";

/**
 * 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트하는 재조정 과정을 수행합니다.
 *
 * @param parentDom - 부모 DOM 요소
 * @param instance - 이전 렌더링의 인스턴스
 * @param node - 새로운 VNode
 * @param path - 현재 노드의 고유 경로
 * @returns 업데이트되거나 새로 생성된 인스턴스
 */
export const reconcile = (
  parentDom: HTMLElement,
  instance: Instance | null,
  node: VNode | null,
  path: string = "0",
): Instance | null => {
  // ===== CASE 1: UNMOUNT =====
  // 새 노드가 null이거나 빈 값이면 기존 인스턴스 제거
  if (node === null || isEmptyValue(node)) {
    if (instance) {
      // DOM 제거 (cleanup은 cleanupUnusedHooks에서 처리)
      removeInstance(parentDom, instance);
    }
    return null;
  }

  const { type, props, key } = node;
  const nodeKey = key ?? null;

  // ===== CASE 2: MOUNT (새로 생성) =====
  if (instance === null) {
    // TEXT 노드 마운트
    if (type === TEXT_ELEMENT) {
      const textNode = document.createTextNode(props.nodeValue ?? "");
      parentDom.appendChild(textNode);

      return {
        kind: NodeTypes.TEXT,
        dom: textNode,
        node,
        children: [],
        key: nodeKey,
        path,
      };
    }

    // HOST 노드 (HTML 요소) 마운트
    if (typeof type === "string") {
      const dom = document.createElement(type);
      setDomProps(dom, props);

      // children 재조정 (재귀)
      const children: (Instance | null)[] = [];
      const childNodes = props.children ?? [];
      for (let i = 0; i < childNodes.length; i++) {
        const childNode = childNodes[i];
        const childPath = createChildPath(path, childNode.key ?? null, i, childNode.type, childNodes);
        const childInstance = reconcile(dom, null, childNode, childPath);
        children.push(childInstance);
      }

      parentDom.appendChild(dom);

      return {
        kind: NodeTypes.HOST,
        dom,
        node,
        children,
        key: nodeKey,
        path,
      };
    }

    // FRAGMENT 마운트
    if (type === Fragment) {
      const children: (Instance | null)[] = [];
      const childNodes = props.children ?? [];
      for (let i = 0; i < childNodes.length; i++) {
        const childNode = childNodes[i];
        const childPath = createChildPath(path, childNode.key ?? null, i, childNode.type, childNodes);
        const childInstance = reconcile(parentDom, null, childNode, childPath);
        children.push(childInstance);
      }

      return {
        kind: NodeTypes.FRAGMENT,
        dom: null,
        node,
        children,
        key: nodeKey,
        path,
      };
    }

    // COMPONENT 마운트
    if (typeof type === "function") {
      // 컴포넌트 스택에 push
      context.hooks.componentStack.push(path);
      context.hooks.visited.add(path);

      // 컴포넌트 함수 실행
      const childNode = type(props);

      // 컴포넌트 스택에서 pop
      context.hooks.componentStack.pop();

      // 자식 노드 재조정
      const childPath = createChildPath(path, null, 0, type);
      const childInstance = reconcile(parentDom, null, childNode, childPath);

      return {
        kind: NodeTypes.COMPONENT,
        dom: null,
        node,
        children: childInstance ? [childInstance] : [],
        key: nodeKey,
        path,
      };
    }

    return null;
  }

  // ===== CASE 3: REPLACE (타입/키 변경) =====
  if (instance.node.type !== node.type || instance.key !== nodeKey) {
    // 제거하기 전에 다음 형제의 DOM을 찾아야 함 (anchor로 사용)
    const firstDom = getFirstDom(instance);
    const anchor = firstDom?.nextSibling as HTMLElement | Text | null;

    removeInstance(parentDom, instance);

    // 새로 마운트 (위의 mount 로직 재사용 - 재귀 호출)
    const newInstance = reconcile(parentDom, null, node, path);

    // anchor가 있으면 올바른 위치에 삽입
    if (newInstance && anchor) {
      insertInstance(parentDom, newInstance, anchor);
    }

    return newInstance;
  }

  // ===== CASE 4: UPDATE (타입과 키가 같음) =====

  // TEXT 노드 업데이트
  if (type === TEXT_ELEMENT && instance.dom) {
    instance.dom.nodeValue = props.nodeValue ?? "";
    instance.node = node;
    return instance;
  }

  // HOST 노드 업데이트
  if (typeof type === "string" && instance.dom) {
    updateDomProps(instance.dom as HTMLElement, instance.node.props, props);

    // children 재조정
    const oldChildren = instance.children;
    const newChildNodes = props.children ?? [];
    const newChildren: (Instance | null)[] = [];

    // key 기반 매칭을 위한 맵 생성
    const oldChildrenByKey = new Map<string, { instance: Instance; index: number }>();
    const oldChildrenByIndex: (Instance | null)[] = [];

    for (let i = 0; i < oldChildren.length; i++) {
      const child = oldChildren[i];
      if (child) {
        if (child.key !== null) {
          oldChildrenByKey.set(child.key, { instance: child, index: i });
        }
        oldChildrenByIndex.push(child);
      } else {
        oldChildrenByIndex.push(null);
      }
    }

    // 매칭된 oldChild를 추적
    const usedOldChildren = new Set<Instance>();

    // 새 자식 노드들을 순회하며 매칭
    for (let i = 0; i < newChildNodes.length; i++) {
      const newChildNode = newChildNodes[i];
      const newChildKey = newChildNode.key ?? null;
      let oldChild: Instance | null = null;

      // key가 있으면 key로 매칭
      if (newChildKey !== null) {
        const match = oldChildrenByKey.get(newChildKey);
        if (match) {
          oldChild = match.instance;
          usedOldChildren.add(oldChild);
        }
      }
      // key가 없으면 인덱스로 매칭 (같은 타입, 아직 사용 안 된 것)
      else {
        for (let j = 0; j < oldChildrenByIndex.length; j++) {
          const candidate = oldChildrenByIndex[j];
          if (
            candidate &&
            !usedOldChildren.has(candidate) &&
            candidate.key === null &&
            candidate.node.type === newChildNode.type
          ) {
            oldChild = candidate;
            usedOldChildren.add(oldChild);
            break;
          }
        }
      }

      const childPath = createChildPath(path, newChildKey, i, newChildNode.type, newChildNodes);

      const newChild = reconcile(instance.dom as HTMLElement, oldChild, newChildNode, childPath);

      newChildren.push(newChild);
    }

    // 사용되지 않은 oldChildren 제거
    for (const oldChild of oldChildren) {
      if (oldChild && !usedOldChildren.has(oldChild)) {
        removeInstance(instance.dom as HTMLElement, oldChild);
      }
    }

    // DOM 순서를 newChildren 순서에 맞게 재정렬
    let expectedNextDom: HTMLElement | Text | null = instance.dom.firstChild as HTMLElement | Text | null;

    for (const child of newChildren) {
      if (child) {
        const doms = getDomNodes(child);
        for (const dom of doms) {
          if (dom !== expectedNextDom) {
            // 순서가 틀리면 올바른 위치로 이동
            if (dom.parentNode === instance.dom) {
              instance.dom.removeChild(dom);
            }
            if (expectedNextDom) {
              instance.dom.insertBefore(dom, expectedNextDom);
            } else {
              instance.dom.appendChild(dom);
            }
          }
          expectedNextDom = dom.nextSibling as HTMLElement | Text | null;
        }
      }
    }

    instance.node = node;
    instance.children = newChildren;
    return instance;
  }

  // FRAGMENT 업데이트
  if (type === Fragment) {
    const oldChildren = instance.children;
    const newChildNodes = props.children ?? [];
    const newChildren: (Instance | null)[] = [];

    // key 기반 매칭을 위한 맵 생성
    const oldChildrenByKey = new Map<string, { instance: Instance; index: number }>();
    const oldChildrenByIndex: (Instance | null)[] = [];

    for (let i = 0; i < oldChildren.length; i++) {
      const child = oldChildren[i];
      if (child) {
        if (child.key !== null) {
          oldChildrenByKey.set(child.key, { instance: child, index: i });
        }
        oldChildrenByIndex.push(child);
      } else {
        oldChildrenByIndex.push(null);
      }
    }

    // 매칭된 oldChild를 추적
    const usedOldChildren = new Set<Instance>();

    // 새 자식 노드들을 순회하며 매칭
    for (let i = 0; i < newChildNodes.length; i++) {
      const newChildNode = newChildNodes[i];
      const newChildKey = newChildNode.key ?? null;
      let oldChild: Instance | null = null;

      // key가 있으면 key로 매칭
      if (newChildKey !== null) {
        const match = oldChildrenByKey.get(newChildKey);
        if (match) {
          oldChild = match.instance;
          usedOldChildren.add(oldChild);
        }
      }
      // key가 없으면 인덱스로 매칭 (같은 타입, 아직 사용 안 된 것)
      else {
        for (let j = 0; j < oldChildrenByIndex.length; j++) {
          const candidate = oldChildrenByIndex[j];
          if (
            candidate &&
            !usedOldChildren.has(candidate) &&
            candidate.key === null &&
            candidate.node.type === newChildNode.type
          ) {
            oldChild = candidate;
            usedOldChildren.add(oldChild);
            break;
          }
        }
      }

      const childPath = createChildPath(path, newChildKey, i, newChildNode.type, newChildNodes);

      const newChild = reconcile(parentDom, oldChild, newChildNode, childPath);

      newChildren.push(newChild);
    }

    // 사용되지 않은 oldChildren 제거
    for (const oldChild of oldChildren) {
      if (oldChild && !usedOldChildren.has(oldChild)) {
        removeInstance(parentDom, oldChild);
      }
    }

    // DOM 순서를 newChildren 순서에 맞게 재정렬
    // Fragment의 경우 parentDom에서 첫 번째 Fragment 자식을 찾음
    let fragmentStart: HTMLElement | Text | null = null;
    for (const child of newChildren) {
      if (child) {
        fragmentStart = getFirstDom(child);
        if (fragmentStart) break;
      }
    }

    let expectedNextDom: HTMLElement | Text | null = fragmentStart;

    for (const child of newChildren) {
      if (child) {
        const doms = getDomNodes(child);
        for (const dom of doms) {
          if (dom !== expectedNextDom) {
            // 순서가 틀리면 올바른 위치로 이동
            if (dom.parentNode === parentDom) {
              parentDom.removeChild(dom);
            }
            if (expectedNextDom) {
              parentDom.insertBefore(dom, expectedNextDom);
            } else {
              parentDom.appendChild(dom);
            }
          }
          expectedNextDom = dom.nextSibling as HTMLElement | Text | null;
        }
      }
    }

    instance.node = node;
    instance.children = newChildren;
    return instance;
  }

  // COMPONENT 업데이트
  if (typeof type === "function") {
    // 컴포넌트 스택에 push
    context.hooks.componentStack.push(path);
    context.hooks.visited.add(path);

    // 커서 리셋
    context.hooks.cursor.set(path, 0);

    // 컴포넌트 함수 재실행
    const childNode = type(props);

    // 컴포넌트 스택에서 pop
    context.hooks.componentStack.pop();

    // 기존 자식과 새 자식 재조정
    const oldChild = instance.children[0] ?? null;
    const childPath = createChildPath(path, null, 0, type);
    const childInstance = reconcile(parentDom, oldChild, childNode, childPath);

    instance.node = node;
    instance.children = childInstance ? [childInstance] : [];
    return instance;
  }

  return instance;
};
