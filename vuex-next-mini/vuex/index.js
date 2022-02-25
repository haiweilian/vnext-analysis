import { computed, inject, reactive, watch } from "vue";

const storeKey = Symbol("store");

export class Store {
  constructor(options) {
    // 严格模式
    this.strict = true;

    // 是否正在进行 commit
    this._committing = false;

    // 解析配置
    this._state = reactive(options.state);
    this._actions = options.actions;
    this._mutations = options.mutations;
    this._getters = options.getters;

    // 计算属性
    this.getters = Object.keys(this._getters).reduce(
      (computedGetters, name) => {
        computedGetters[name] = computed(() => {
          return this._getters[name](this.state);
        });
        return computedGetters;
      },
      {}
    );

    // 开启严格模式
    enableStrictMode(this);
  }

  // 获取 state
  get state() {
    return this._state;
  }

  // 只允许读取
  set state(v) {
    console.error("不允许修改直接修改");
  }

  // 安装插件
  install = (app) => {
    app.provide(storeKey, this);
    app.config.globalProperties.$store = this;
  };

  // 执行 mutation
  commit = (type, payload) => {
    const fn = this._mutations[type];
    if (fn) {
      this._withCommit(() => {
        fn(this.state, payload);
      });
    } else {
      console.error("未知 mutation 类型");
    }
  };

  // 执行 action
  dispatch = (type, payload) => {
    const fn = this._actions[type];
    if (fn) {
      fn(this, payload);
    } else {
      console.error("未知 action 类型");
    }
  };

  // commit 函数包装
  _withCommit = (fn) => {
    const committing = this._committing;
    // 开启：此时可以修改 state
    this._committing = true;
    // 执行 mutation
    fn();
    // 关闭：此时不能修改 state
    this._committing = committing;
  };
}

export function useStore() {
  return inject(storeKey);
}

export function createStore(options) {
  return new Store(options);
}

// 启用严格模式
export function enableStrictMode(store) {
  watch(
    () => store.state,
    () => {
      if (!store._committing) {
        console.error("必须通过 mutation 修改");
      }
    },
    { deep: true, flush: "sync" }
  );
}
