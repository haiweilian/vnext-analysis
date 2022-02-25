import { createStore } from "../../vuex/index";

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
});
