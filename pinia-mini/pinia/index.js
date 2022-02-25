import { computed, reactive } from "vue";

let activePinia = null;

const { assign } = Object;

// 设置当前激活的 pinia
function setActivePinia(pinia) {
  activePinia = pinia;
}

// 获取当前激活的 pinia
function getActivePinia() {
  return activePinia;
}

// 创建全局实例
export function createPinia() {
  const pinia = {
    install() {
      setActivePinia(pinia);
    },
    cache: new Map(), // 缓存
  };

  return pinia;
}

// 定义模块 store
// id: 模块 id
// options：对象 或 函数
export function defineStore(id, options) {
  function useStore() {
    const pinia = getActivePinia();

    // 是否已经存在
    if (!pinia.cache.has(id)) {
      if (typeof options === "function") {
        createSetupStore(id, options, pinia);
      } else {
        createOptionsStore(id, options, pinia);
      }
    }

    // 获取缓存返回
    const store = pinia.cache.get(id);

    return store;
  }

  return useStore;
}

// 处理对象配置，转换配置为函数
function createOptionsStore(id, options, pinia) {
  const { state, actions, getters } = options;

  let store;

  // 如果是对象会转化配置项，最后还是转化为函数，所有的配置转换成平级返回
  function setup() {
    return assign(
      // state 值
      state(),
      // actions 函数不变
      actions,
      // getters 转换成计算属性
      Object.keys(getters).reduce((computedGetters, name) => {
        computedGetters[name] = computed(() => {
          return getters[name].call(store);
        });
        return computedGetters;
      }, {})
    );
  }

  store = createSetupStore(id, setup, pinia);

  return store;
}

// 处理函数配置，添加实例方法
function createSetupStore(id, setup, pinia) {
  const store = reactive({
    $reset: () => {},
    $patch: () => {},
  });

  assign(store, setup());

  pinia.cache.set(id, store);

  return store;
}
