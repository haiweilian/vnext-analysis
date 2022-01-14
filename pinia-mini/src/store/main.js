import { defineStore } from "../../pinia/index";

export const useStore = defineStore("main", {
  // 状态值
  state() {
    return {
      count: 0,
    };
  },
  // 计算属性
  getters: {
    evenOrOdd() {
      return this.count % 2 === 0 ? "even" : "odd";
    },
  },
  // 动作方法
  actions: {
    increment() {
      this.count++;
    },
    decrement(state) {
      this.count--;
    },
    incrementIfOdd() {
      if ((this.count + 1) % 2 === 0) {
        this.increment();
      }
    },
    incrementAsync() {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.increment();
          resolve();
        }, 1000);
      });
    },
  },
});
