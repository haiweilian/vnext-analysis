### KeepAlive 的缓存机制是什么？

为了防止缓存内容过多造成占用内存过多，内部会设置最大的缓存个数。并采用一种 `LRU` 缓存算法。

```js
// 缓存的 key 集合
const keys = new Set();
// 最大缓存个数
const max = 5;

// 添加缓存
function add(key) {
  if (keys.has(key)) {
    // 如果缓存中存在： 把这个 key 从集合中删除再添加，保持 key 的活跃度。
    // 旧：[1, 2, 3]
    // add(1)
    // 新：[2, 3, 1]
    keys.delete(key);
    keys.add(key);
  } else {
    // 如果缓存中存在：则添加一个缓存
    keys.add(key);
    // 如果缓存个数大于最大的缓存数，则删除最久不用的 key。
    // 最久是 key 集合中的第一个，因为每次命中缓存都会从新添加到后面。
    if (keys.size > max) {
      keys.delete(keys.values().next().value);
    }
  }
}
```

### Teleport 的设计思路是什么？

与组件的执行基本一致，区别在于如果检测到是 `Teleport` 组件会在原始位置和目标位置插入参考点作为移动的目标。

### Transition 的设计思路是什么？

当 `DOM` 挂载的时候，添加带过渡效果的类名到元素上。当卸载的时候先不立即卸载 `DOM` 元素，先移除旧的过滤效果的类名在添加新的过渡效果的类名，监听 `animationend` 事件过渡效果执行完毕再执行卸载。
