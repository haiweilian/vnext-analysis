import Module from "./module";
import { assert, forEachValue } from "../util";

// 所有模块的集合，主要是建立模块的上下级关系和初始化模块。
// 最终会得到一个以 root 为根的结构
// {
//   root: {
//     Module {}
//   }
// }
export default class ModuleCollection {
  constructor(rawRootModule) {
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false);
  }

  // 从根路径开始，根据路径往下查找子模块
  // 如有 ['child1', 'child2'] 路径，root 找到 child1 在找到 child2
  get(path) {
    return path.reduce((module, key) => {
      return module.getChild(key);
    }, this.root);
  }

  // 获取命名空间：如果 namespaced 为 true，把模块的 key 拼成路径
  getNamespace(path) {
    let module = this.root;
    return path.reduce((namespace, key) => {
      module = module.getChild(key);
      return namespace + (module.namespaced ? key + "/" : "");
    }, "");
  }

  update(rawRootModule) {
    update([], this.root, rawRootModule);
  }

  // 注册一个模块
  register(path, rawModule, runtime = true) {
    if (__DEV__) {
      assertRawModule(path, rawModule);
    }

    // 根据配置解析出一个模块，这个模块本身包含了自己数据的处理方法
    const newModule = new Module(rawModule, runtime);
    if (path.length === 0) {
      // 是否为根模块，添加到 root 属性上
      this.root = newModule;
    } else {
      // 如果是子模块，获取到父级模块，并与父模块建立关系
      const parent = this.get(path.slice(0, -1));
      parent.addChild(path[path.length - 1], newModule);
    }

    // register nested modules
    // 是否有子模块，如果有则递归继续处理
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime);
      });
    }
  }

  unregister(path) {
    const parent = this.get(path.slice(0, -1));
    const key = path[path.length - 1];
    const child = parent.getChild(key);

    if (!child) {
      if (__DEV__) {
        console.warn(
          `[vuex] trying to unregister module '${key}', which is ` +
            `not registered`
        );
      }
      return;
    }

    if (!child.runtime) {
      return;
    }

    parent.removeChild(key);
  }

  isRegistered(path) {
    const parent = this.get(path.slice(0, -1));
    const key = path[path.length - 1];

    if (parent) {
      return parent.hasChild(key);
    }

    return false;
  }
}

function update(path, targetModule, newModule) {
  if (__DEV__) {
    assertRawModule(path, newModule);
  }

  // update target module
  targetModule.update(newModule);

  // update nested modules
  if (newModule.modules) {
    for (const key in newModule.modules) {
      if (!targetModule.getChild(key)) {
        if (__DEV__) {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
              "manual reload is needed"
          );
        }
        return;
      }
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      );
    }
  }
}

const functionAssert = {
  assert: (value) => typeof value === "function",
  expected: "function",
};

const objectAssert = {
  assert: (value) =>
    typeof value === "function" ||
    (typeof value === "object" && typeof value.handler === "function"),
  expected: 'function or object with "handler" function',
};

const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert,
};

function assertRawModule(path, rawModule) {
  Object.keys(assertTypes).forEach((key) => {
    if (!rawModule[key]) return;

    const assertOptions = assertTypes[key];

    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      );
    });
  });
}

function makeAssertionMessage(path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`;
  if (path.length > 0) {
    buf += ` in module "${path.join(".")}"`;
  }
  buf += ` is ${JSON.stringify(value)}.`;
  return buf;
}
