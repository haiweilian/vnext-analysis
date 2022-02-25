import {
  Pinia,
  PiniaStorePlugin,
  setActivePinia,
  piniaSymbol,
} from './rootStore'
import { ref, App, markRaw, effectScope, isVue2 } from 'vue-demi'
import { registerPiniaDevtools, devtoolsPlugin } from './devtools'
import { IS_CLIENT } from './env'
import { StateTree, StoreGeneric } from './types'

/**
 * Creates a Pinia instance to be used by the application
 */
// PINIA-流程设计 1-createPinia()
export function createPinia(): Pinia {
  const scope = effectScope(true)
  // NOTE: here we could check the window object for a state and directly set it
  // if there is anything like it with Vue 3 SSR
  const state = scope.run(() => ref<Record<string, StateTree>>({}))!

  let _p: Pinia['_p'] = []
  // plugins added before calling app.use(pinia)
  let toBeInstalled: PiniaStorePlugin[] = []

  const pinia: Pinia = markRaw({
    // PINIA-流程设计 1.1-安装方法
    install(app: App) {
      // this allows calling useStore() outside of a component setup after
      // installing pinia's plugin
      // 设置当前激活的 pinia 实例，为什么这么做?
      // 因为可以在组件之外调用 pinia，相对应的 getActivePinia 能说明这个效果。
      setActivePinia(pinia)
      if (!isVue2) {
        // 保存 app 实例
        pinia._a = app
        // 全局注入 pinia 并在根实例上挂载 $pinia
        app.provide(piniaSymbol, pinia)
        app.config.globalProperties.$pinia = pinia
        /* istanbul ignore else */
        if (__DEV__ && IS_CLIENT) {
          registerPiniaDevtools(app, pinia)
        }
        toBeInstalled.forEach((plugin) => _p.push(plugin))
        toBeInstalled = []
      }
    },

    // PINIA-流程设计 1.2-添加插件
    use(plugin) {
      if (!this._a && !isVue2) {
        toBeInstalled.push(plugin)
      } else {
        _p.push(plugin)
      }
      return this
    },

    // PINIA-流程设计 1.3-全局属性
    // 插件
    _p,
    // it's actually undefined here
    // @ts-expect-error
    // Vue 实例
    _a: null,
    // 作用域
    _e: scope,
    // 缓存
    _s: new Map<string, StoreGeneric>(),
    // 全局状态
    state,
  })

  // pinia devtools rely on dev only features so they cannot be forced unless
  // the dev build of Vue is used
  if (__DEV__ && IS_CLIENT) {
    pinia.use(devtoolsPlugin)
  }

  return pinia
}
