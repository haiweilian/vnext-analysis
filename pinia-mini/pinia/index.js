import { computed, reactive, ref, toRefs } from "vue";

let activePinia = null;

const { assign } = Object;

function setActivePinia(pinia) {
  activePinia = pinia;
}

function getActivePinia() {
  return activePinia;
}

// 创建全局实例
export function createPinia() {
  const pinia = {
    install() {
      setActivePinia(pinia);
    },
    state: ref({}),
    cache: new Map(),
  };

  return pinia;
}

// 定义模块 Store
export function defineStore(id, options) {
  function useStore() {
    const pinia = getActivePinia();

    // 是否已经存在
    if (!pinia.cache.has(id)) {
      createOptionsStore(id, options, pinia);
    }

    const store = pinia.cache.get(id);

    return store;
  }

  return useStore;
}

function createOptionsStore(id, options, pinia) {
  const { state, actions, getters } = options;

  let store;

  function setup() {
    pinia.state.value[id] = state ? state() : {};

    return assign(
      // state 转换成单个 ref
      toRefs(pinia.state.value[id]),
      // actions 函数不变
      actions,
      // getters 转换成计算属性
      Object.keys(getters).reduce((computedGetters, name) => {
        computedGetters[name] = computed(() => {
          return getters[name].call(store);
        });
      }, {})
    );
  }

  store = createSetupStore(id, setup, pinia);

  return store;
}

function createSetupStore(id, setup, pinia) {
  const store = reactive({
    $reset: () => {},
    $patch: () => {},
  });

  assign(store, setup());

  pinia.cache.set(id, store);

  return store;
}
