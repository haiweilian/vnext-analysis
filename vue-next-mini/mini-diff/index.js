/**
 * vue 根据 标签名 和 key 判断是不是同一个节点。
 * 源码：vue-next-3.2.0/packages/runtime-core/src/vnode.ts
 */
function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}

/**
 * vue 组件的操作方法，这里使用数组模拟，真实的操作应该是操作 dom 元素。
 * 源码：vue-next-3.2.0/packages/runtime-core/src/renderer.ts
 */
function patch(n1, n2, container, anchor) {
  if (n1 === null) {
    mount(n2, container, anchor);
  } else {
    update(n1, n2);
  }
}
function mount(n2, container, anchor) {
  container.splice(anchor, 0, n2);
}
function update(n1, n2) {
  n1.children = n2.children;
}
function unmount(vnode, parent) {
  let index = parent.findIndex((item) => item.key === vnode.key);
  parent.splice(index, 1);
}
function move(vnode, container, anchor) {
  unmount(vnode, container);
  mount(vnode, container, anchor);
}

/**
 * 创建 vnode 对象
 * 源码：vue-next-3.2.0/packages/runtime-core/src/vnode.ts
 */
function createVNode(type, props, children) {
  const vnode = {
    type,
    key: props.key,
    children,
  };
  return vnode;
}

/**
 * 新旧节点都是数组的情况
 * 源码：vue-next-3.2.0/packages/runtime-core/src/renderer.ts
 */
function patchKeyedChildren(c1, c2) {
  // 头部的索引
  let i = 0;
  // 新节点长度
  const l2 = c2.length;
  // 旧子节点的尾部索引
  let e1 = c1.length - 1;
  // 新子节点的尾部索引
  let e2 = l2 - 1;

  // 1. 从头部开始同步
  // (a b) c
  // (a b) d e
  while (i <= e1 && i <= e2) {
    const n1 = c1[i];
    const n2 = c2[i];
    if (isSameVNodeType(n1, n2)) {
      // 相同的节点，递归执行 patch 更新节点
      patch(n1, n2);
    } else {
      // 不相同结束，头部同步结束
      break;
    }
    // 向右移动头部指针，继续下一个
    i++;
  }

  // 2. sync from end
  // 2. 从尾部开始同步
  // a (b c)
  // d e (b c)
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1];
    const n2 = c2[e2];
    if (isSameVNodeType(n1, n2)) {
      // 相同的节点，递归执行 patch 更新节点
      patch(n1, n2);
    } else {
      // 不相同结束，尾部同步结束
      break;
    }
    // 向左移动尾部指针，继续上一个
    e1--;
    e2--;
  }

  // 3. common sequence + mount
  // 3. 挂载剩余的新节点
  // 3. 前后节点 diff 完之后。旧的没有，新的有多余的节点挂载剩余的新节点，
  // (a b)
  // (a b) c
  // i = 2, e1 = 1, e2 = 2
  // (a b)
  // c (a b)
  // i = 0, e1 = -1, e2 = 0
  if (i > e1) {
    if (i <= e2) {
      // 从索引 i 开始到索引 e2 之间挂载新节点
      while (i <= e2) {
        // 挂载新节点, n1 == null
        patch(null, c2[i], c1, i);
        i++;
      }
    }
  }

  // 4. common sequence + unmount
  // 4. 删除剩余的旧节点
  // 4. 前后节点 diff 完之后。新的没有，旧的有多余的节点删除剩余的旧节点。
  // (a b) c
  // (a b)
  // i = 2, e1 = 2, e2 = 1
  // a (b c)
  // (b c)
  // i = 0, e1 = 0, e2 = -1
  else if (i > e2) {
    // 从索引 i 开始到索引 e1 之间删除旧节点
    while (i <= e1) {
      unmount(c1[i], c1);
      i++;
    }
  }

  // 5. 未知子序列
  // 5. 如果新旧都存在，通过更新、删除、添加、移动这些动作来操作节点
  // [i ... e1 + 1]: a b [c d e f] g
  // [i ... e2 + 1]: a b [e c d i] g
  // i = 2, e1 = 5, e2 = 5
  else {
    // 旧子序列开始索引
    const s1 = i;
    // 新子序列开始索引
    const s2 = i;

    // 5.1 根据 key 建立新子序列的索引图，
    // 1、便于通过旧节点的 key 获取 新节点的位置。
    const keyToNewIndexMap = new Map();
    for (i = s2; i <= e2; i++) {
      const nextChild = c2[i];
      keyToNewIndexMap.set(nextChild.key, i);
    }
    // 0: {"e" => 2}
    // 1: {"c" => 3}
    // 2: {"d" => 4}
    // 3: {"i" => 5}
    console.log("keyToNewIndexMap", keyToNewIndexMap);

    // 5.2 更新和删除
    // 1、找到匹配的节点更新。
    // 2、删除不在新子序列中的节点的旧节点。
    // 3、判断是否有移动节点
    // 新子序列已更新节点的数量
    let patched = 0;
    // 新子序列待更新节点的数量，等于新子序列的长度
    const toBePatched = e2 - s2 + 1;
    // 是否存在要移动的节点
    let moved = false;
    // used to track whether any node has moved
    // 用于跟踪判断是否有节点移动
    let maxNewIndexSoFar = 0;
    // 这个数组存储新子序列中的元素在旧子序列节点的索引，用于确定最长递增子序列
    const newIndexToOldIndexMap = new Array(toBePatched);
    // 初始化数组，每个元素的值都是 0
    // 0 是一个特殊的值，如果遍历完了仍有元素的值为 0，则说明这个新节点没有对应的旧节点
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0; // [5, 3, 4, 0]

    // 正序遍历旧子序列
    for (i = s1; i <= e1; i++) {
      // 旧节点
      const prevChild = c1[i];

      if (patched >= toBePatched) {
        // 所有新的子序列节点都已经更新，剩余的节点删除
        unmount(prevChild, c1);
        continue;
      }

      // 查找旧子序列中的节点在新子序列中的索引
      let newIndex = keyToNewIndexMap.get(prevChild.key);

      // 找不到说明旧子序列已经不存在于新子序列中，则删除该节点
      if (newIndex === undefined) {
        unmount(prevChild, c1);
      } else {
        // 更新新子序列中的元素在旧子序列中的索引，这里加 1 偏移，是为了避免 i 为 0 的特殊情况，影响对后续最长递增子序列的求解
        newIndexToOldIndexMap[newIndex - s2] = i + 1;
        // maxNewIndexSoFar 始终存储的是上次求值的 newIndex，如果不是一直递增，则说明有移动
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex;
        } else {
          moved = true;
        }
        // 更新新旧子序列中匹配的节点
        patch(prevChild, c2[newIndex]);
        // 已更新加 1
        patched++;
      }
    }

    console.log("newIndexToOldIndexMap", newIndexToOldIndexMap);

    // 5.3 移动和挂载
    // 仅当节点移动时生成最长递增子序列
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : [];
    console.log("increasingNewIndexSequence", increasingNewIndexSequence);

    let j = increasingNewIndexSequence.length - 1;

    // 倒序遍历以便我们可以使用最后更新的节点作为锚点
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i;
      const nextChild = c2[nextIndex];
      // 没有对应的旧节点
      if (newIndexToOldIndexMap[i] === 0) {
        // i = 3
        // 挂载新的子节点
        patch(null, nextChild, c1, nextIndex);
      } else if (moved) {
        // 没有最长递增子序列（reverse 的场景）或者当前的节点索引不在最长递增子序列中，需要移动
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          move(nextChild, c1, nextIndex);
        } else {
          // i == 2 和 i == 1 包含在递增子序列中不需要移动
          // 倒序递增子序列，递增的不需要移动
          j--;
        }
      }
    }
  }
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
// https://leetcode-cn.com/problems/longest-increasing-subsequence
// 返回最长子序列元素所在的索引
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}

// =================================================================
// ============================= 测试  ==============================
// =================================================================

/**
 * @description 创建节点
 */
function generateVNode(node, flag) {
  return node.map((n) => {
    return createVNode(
      "li",
      {
        key: n,
      },
      `${flag}-${n}`
    );
  });
}

/**
 * 新节点有剩余
 */
// const old1 = generateVNode(["a", "b", "c", "d"], "old");
// const new1 = generateVNode(["a", "b", "e", "c", "d"], "new");
// console.log("Before update", old1, new1);
// patchKeyedChildren(old1, new1);
// console.log("After update", old1, new1);

/**
 * 旧节点有剩余
 */
// const old2 = generateVNode(["a", "b", "c", "d", "e"], "old");
// const new2 = generateVNode(["a", "b", "d", "e"], "new");
// console.log("Before update", old2, new2);
// patchKeyedChildren(old2, new2);
// console.log("After update", old2, new2);

/**
 * 未知子序列
 */
const old3 = generateVNode(["a", "b", "c", "d", "e", "f", "g"], "old");
const new3 = generateVNode(["a", "b", "e", "c", "d", "i", "g"], "new");
console.log("Before update", old3, new3);
patchKeyedChildren(old3, new3);
console.log("After update", old3, new3);
