### 为什么 Proxy 和 Reflect 一起使用？

因为 `Proxy` 代理对象指定的拦截函数是自定义对象本身的内部方法和行为（也就是我们把内部函数覆盖了）。而 `Reflect` 提供了与 `Proxy` 内部相同的方法，所以我们在自定义方法的同时要保持原始的行为和指定内部的上下文。

### 针对数组查找方法做了哪些处理？

```js
const obj = {};
const arr = reactive([obj]);
arr.includes(obj); // false
```

因为 `arr` 是代理后的对象，所以查找不处理。所以重写 `includes`、`indexOf` 等查找方法先在代理对象查找，找不到再在 `arr.raw` 原始对象上查找。

### 针对数组修改方法做了哪些处理？

```js
const arr = reactive([]);

// 两个 effect 造成冲突导致内存溢出
effect(() => {
  arr.push(1);
});
effect(() => {
  arr.push(2);
});
```

因为数组的方法会在修改的同时访问 `length` 属性的时候同时收集依赖，当调用第一个副作用的时候改变 `length` 就会执行第二个副作用，当调用第二个副作用的时候改变 `length` 又会执行一个副作用造成死循环。所以重写 `push`、`pop` 等方法，放弃对 `length` 依赖的收集，在调用方法之前停止收集执行完在开始收集。
