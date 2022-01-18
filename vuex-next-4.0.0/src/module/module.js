import { forEachValue } from "../util";

// Base data struct for store's module, package with some attribute and method
// 存储模块的基本数据结构，一个包含 state、getters、mutations、actions 的对象，并包含一些处理方法
// 得到如下结构
// {
//   runtime: false
//   state: {count: 0}
//   _children: {}
//   _rawModule: {
//     actions: {incrementIfOdd: ƒ, incrementAsync: ƒ}
//     getters: {evenOrOdd: ƒ}
//     mutations: {increment: ƒ, decrement: ƒ}
//     state: {count: 0}
//   }
// }
export default class Module {
  constructor(rawModule, runtime) {
    this.runtime = runtime;
    // Store some children item
    // 模块的子模块
    this._children = Object.create(null);
    // Store the origin module object which passed by programmer
    // 原始模块
    this._rawModule = rawModule;
    const rawState = rawModule.state;

    // Store the origin module's state
    // 默认的 state
    this.state = (typeof rawState === "function" ? rawState() : rawState) || {};
  }

  // 是否为命名空间，namespaced 是否为 true
  get namespaced() {
    return !!this._rawModule.namespaced;
  }

  // 添加子模块
  addChild(key, module) {
    this._children[key] = module;
  }

  // 删除子模块
  removeChild(key) {
    delete this._children[key];
  }

  // 默认子模块
  getChild(key) {
    return this._children[key];
  }

  // 是否包含子模块
  hasChild(key) {
    return key in this._children;
  }

  // 更新子模块，更新对应的属性对象
  update(rawModule) {
    this._rawModule.namespaced = rawModule.namespaced;
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions;
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations;
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters;
    }
  }

  // 遍历子模块，都是通过 forEachValue 遍历，执行 fn 参数为 fn(value, key)
  forEachChild(fn) {
    forEachValue(this._children, fn);
  }

  // 遍历模块 getter
  forEachGetter(fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn);
    }
  }

  // 遍历模块 action
  forEachAction(fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn);
    }
  }

  // 遍历模块 mutation
  forEachMutation(fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn);
    }
  }
}
