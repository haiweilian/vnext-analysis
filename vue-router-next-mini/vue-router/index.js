import { shallowRef, defineComponent, inject, provide, h, computed } from "vue";

const routerKey = "routerKey";
const routerViewLocationKey = "routerViewLocationKey";
const viewDepthKey = "viewDepthKey";

/**
 * 默认配置
 */
export const START_LOCATION_NORMALIZED = {
  path: "/",
  name: undefined,
  params: {},
  query: {},
  hash: "",
  fullPath: "/",
  matched: [],
  meta: {},
  redirectedFrom: undefined,
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
  setup(props, { slots }) {
    const injectedRoute = inject(routerViewLocationKey);
    const depth = inject(viewDepthKey, 0);
    provide(viewDepthKey, depth + 1);

    return () => {
      console.log(injectedRoute.value.matched[depth], depth);

      let ViewComponent = null;
      if (injectedRoute.value.matched[depth]) {
        ViewComponent = injectedRoute.value.matched[depth];
      }
      return h(ViewComponent && ViewComponent.component);
    };
  },
});

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
    // 创建新的理由配置
    const normalizedRecord = {
      re: undefined,
      record: route,
      parent: parent,
    };

    // 处理上下级路径 parent + path
    if (parent && route.path[0] !== "/") {
      // 拼接上级路径
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

  // 获取路由
  function getRoutes() {
    return matchers;
  }

  // 解析路径
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
    getRoutes,
    resolve,
  };
}

/**
 * 创建路由
 * @param {*} options
 */
function createRouter(options) {
  const matcher = createRouterMatcher(options.routes);
  console.log("options", options);
  console.log("matcher", matcher.getRoutes());

  const currentRoute = shallowRef(START_LOCATION_NORMALIZED);

  // 当前的路由模式
  let routerHistory = options.history;

  function push(to) {
    pushWithRedirect(to);
  }

  function pushWithRedirect(to) {
    const targetLocation = matcher.resolve(to);
    console.log("targetLocation", targetLocation);

    routerHistory.push(targetLocation.path);

    Promise.resolve().then(() => {
      currentRoute.value = targetLocation;
    });
  }

  // 前置导航守卫
  function beforeEach(cb) {}

  // 后置导航守卫
  function afterEach(cb) {}

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
      // currentRoute 表示当前的路径对象，它可以获取当前路径信息(浅响应)。
      app.provide(routerViewLocationKey, currentRoute);
    },
  };
  return router;
}

export { createRouter, createWebHistory };
