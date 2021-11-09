// 对 Promise 原理不理解的： https://github.com/xieranmaya/blog/issues/3

// 解析顺序：https://next.router.vuejs.org/zh/guide/advanced/navigation-guards.html#完整的导航解析流程

// 守卫是利用 Promise 的串行，把守卫函数都包装成 Promise，如下示例：输出 1, 2, 3
new Promise((resolve, reject) => {
  resolve();
})
  .then(() => {
    return new Promise((resolve, reject) => {
      resolve();
    })
      .then(() => {
        console.log(1);
      })
      .then(() => {
        console.log(2);
      });
  })
  .then(() => {
    console.log(3);
  });
