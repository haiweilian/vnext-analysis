import { shallowRef, defineComponent, inject, provide, h } from "vue";

const routerKey = "routerKey";
const routerViewLocationKey = "routerViewLocationKey";
const viewDepthKey = "viewDepthKey";

/**
 * 默认配置
 */
export const START_LOCATION_NORMALIZED = {
  path: "/",
  matched: [],
};

/**
 * 组件
 */
const RouterLink = defineComponent({
  props: {
    to: {
      type: String,
      required: true,
    },
  },
  setup(props, { slots }) {
    // 获取到当前的路由实例
    const router = inject(routerKey);
    return () => {
      return h(
        "a",
        {
          href: props.to,
          onClick: (e) => {
            e.preventDefault();
            router.push({
              path: props.to,
            });
          },
        },
        slots.default && slots.default()
      );
    };
  },
});
const RouterView = defineComponent({
  props: {
    name: {
      type: String,
      default: "default",
    },
  },
  setup(props, { slots }) {
    // 获取当前的路由对象
    const injectedRoute = inject(routerViewLocationKey);

    // 获取当前嵌套的层级，并往下继续传递 depth + 1
    const depth = inject(viewDepthKey, 0);
    provide(viewDepthKey, depth + 1);

    // 更具 depth 获取到对应的层级，根据 name 获取到对应的命名视图。
    return () => {
      let ViewComponent = null;
      if (injectedRoute.value.matched[depth]) {
        ViewComponent = injectedRoute.value.matched[depth];
      }
      if (ViewComponent) {
        return h(ViewComponent.components[props.name]);
      } else {
        return null;
      }
    };
  },
});

/**
 * UseApi
 */
export function useRoute() {
  return inject(routerViewLocationKey);
}

export function useRouter() {
  return inject(routerKey);
}

/**
 * 路由模式
 */
function createWebHistory() {
  function push(path) {
    window.history.pushState(path, "", path);
  }

  return {
    push,
  };
}

/**
 * 解析路由配置
 */
function createRouterMatcher(routes) {
  // 解析结果
  let matchers = [];

  // 添加路由
  function addRoute(route, parent) {
    // 标准化路由配置
    const normalizedRecord = {
      re: undefined,
      parent: parent,
      record: {
        path: route.path,
        children: route.children,
        components:
          "components" in route
            ? route.components || {}
            : { default: route.component },
      },
    };

    // 如果父级存在(不是根层级)并且子级路由不是以 / 开头的，那么就是嵌套路径。
    // 当前路径拼接上父级路径:
    // '/' + 'home-child' => '/home-child'
    // '/' + 'home-child' + 'child' => '/home-child/child'
    if (parent && route.path[0] !== "/") {
      let parentPath = parent.record.path;
      let connectingSlash = parentPath.endsWith("/") ? "" : "/";
      route.path = `${parentPath}${connectingSlash}${route.path}`;
    }

    // 创建匹配路径的正则
    normalizedRecord.re = new RegExp(`^\\${route.path}\/?$`, "i");

    // 包含下级路由
    if ("children" in route) {
      route.children.forEach((route) => addRoute(route, normalizedRecord));
    }

    matchers.push(normalizedRecord);
  }

  // 解析路径，从当前往上找父级组成一组匹配
  function resolve(location) {
    const matcher = matchers.find((m) => m.re.test(location.path));

    const matched = [];
    let parentMatcher = matcher;
    while (parentMatcher) {
      matched.unshift(parentMatcher.record);
      parentMatcher = parentMatcher.parent;
    }

    return {
      path: location.path,
      matched: matched,
    };
  }

  // 默认路由
  routes.forEach((route) => addRoute(route));

  return {
    addRoute,
    resolve,
  };
}

/**
 * 创建路由
 * @param {*} options
 */
function createRouter(options) {
  // 解析路由配置
  const matcher = createRouterMatcher(options.routes);

  // 创建响应式的路由对象
  const currentRoute = shallowRef(START_LOCATION_NORMALIZED);

  // 收集守卫
  const beforeGuards = [];
  const afterGuards = [];

  // 当前的路由模式
  let routerHistory = options.history;

  // router.push
  function push(to) {
    const targetLocation = matcher.resolve(to);

    routerHistory.push(targetLocation.path);

    const from = currentRoute.value;
    navigate(to, from).then(() => {
      currentRoute.value = targetLocation;

      // 后置守卫
      for (const guard of afterGuards) {
        guard(to, from);
      }
    });
  }

  function navigate(to, from) {
    let guards = [];

    // 执行前置守卫
    beforeGuards.forEach((guard) => {
      guards.push(guardToPromiseFn(guard, to, from));
    });

    return runGuardQueue(guards).then(() => {
      // ... 执行其他的守卫
    });
  }

  // 串行执行守卫
  function runGuardQueue(guards) {
    // Promise.resolve().then(() => guard1()).then(() => guard2())
    // guard() 执行后返回的 Promise
    return guards.reduce(
      (promise, guard) => promise.then(() => guard()),
      Promise.resolve()
    );
  }

  // 把守卫包装成 Promise
  function guardToPromiseFn(guard, to, from) {
    return () => {
      return new Promise((resolve, reject) => {
        // 定义 next ，当执行 next 的时候这个 Promise 才会从 pending -> resolve
        const next = () => resolve();
        // 执行守卫函数并把 next 函数传递过去
        guard(to, from, next);
        // 如果守卫函数没有定义 next，默认执行 next
        if (guard.length < 3) next();
      });
    };
  }

  // 前置守卫
  function beforeEach(cb) {
    beforeGuards.push(cb);
  }

  // 后置守卫
  function afterEach(cb) {
    afterGuards.push(cb);
  }

  const router = {
    currentRoute,
    push,
    beforeEach,
    afterEach,
    install(app) {
      app.component("RouterLink", RouterLink);
      app.component("RouterView", RouterView);

      // router 表示当前路由的对象，它可以调用方法操作路由。
      app.provide(routerKey, router);
      // currentRoute 表示当前的路径对象，它可以获取当前路径信息。
      app.provide(routerViewLocationKey, currentRoute);
    },
  };
  return router;
}

export { createRouter, createWebHistory };
