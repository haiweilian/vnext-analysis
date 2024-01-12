import { createStore } from "../../../vuex-next-4.0.0/dist/vuex.esm-bundler.js";

window.__DEV__ = true;

const state = {
  count: 0,
};

const mutations = {
  increment(state) {
    state.count++;
  },
  decrement(state) {
    state.count--;
  },
};

const actions = {
  incrementIfOdd({ commit, state }) {
    if ((state.count + 1) % 2 === 0) {
      commit("increment");
    }
  },
  incrementAsync({ commit }) {
    return new Promise((resolve) => {
      setTimeout(() => {
        commit("increment");
        resolve();
      }, 1000);
    });
  },
};

const getters = {
  evenOrOdd: (state) => (state.count % 2 === 0 ? "even" : "odd"),
};

export default createStore({
  state,
  getters,
  actions,
  mutations,
  modules: {
    // 子模块
    child2: {
      state: {
        deep: 2,
      },
      // 子子模块
      modules: {
        child3: {
          state: {
            deep: 3,
          },
        },
      },
    },
  },
});
