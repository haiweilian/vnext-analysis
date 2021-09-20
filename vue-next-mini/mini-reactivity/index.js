// 创建代理的对象
const reactiveMap = new WeakMap();

// 代理对象的依赖
const targetMap = new WeakMap();

// 当前运行的副作用含糊
let activeEffect = null;

/**
 * effect 函数
 * 源码：vue-next-3.2.0/packages/reactivity/src/effect.ts
 */
function effect(fn) {
  activeEffect = fn;
  fn();
  activeEffect = null;
}

/**
 * get、set 处理函数
 */
const mutableHandlers = {
  get(target, key, receiver) {
    // 调用 track 进行依赖收集调用
    track(target, key);
    // 如果是对象，则递归执行响应式
    const result = Reflect.get(target, key, receiver);
    if (Object.is(result)) {
      reactive(result);
    }
    return result;
  },
  set(target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver);
    trigger(target, key, value);
    return result;
  },
};

/**
 * 依赖收集
 */
function track(target, key) {
  // 1、每个 target 对应一个 depsMap，不存在创建。
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  // 2、每个 key 对应一个 dep 集合，不存在创建。
  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = new Set()));
  }
  // 3、收集副作用函数进依赖
  if (!dep.has(activeEffect) && activeEffect) {
    dep.add(activeEffect);
  }
}

/**
 * 派发通知
 */
function trigger(target, key, value) {
  // 1、通过 targetMap 拿到 target 的 depsMap
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  // 2、通过 depsMap 拿到 key 的 dep
  const dep = depsMap.get(key);

  // 3、执行收集副作用函数
  for (let d of dep) {
    d();
  }
}

/**
 * 创建代理对象
 */
function createReactiveObject(target) {
  // 如果已经代理过直接返回
  const existingProxy = reactiveMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  // 通过 Proxy 劫持 target 对象做一些操作
  // 1、访问对象属性会触发 get 函数；
  // 2、设置对象属性会触发 set 函数；
  const proxy = new Proxy(target, mutableHandlers);

  // 保存已代理过的对象
  reactiveMap.set(target, proxy);

  return proxy;
}

/**
 * reactive
 */
function reactive(target) {
  return createReactiveObject(target);
}
