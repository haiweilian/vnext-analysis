import { TrackOpTypes, TriggerOpTypes } from './operations'
import { extend, isArray, isIntegerKey, isMap } from '@vue/shared'
import { EffectScope, recordEffectScope } from './effectScope'
import {
  createDep,
  Dep,
  finalizeDepMarkers,
  initDepMarkers,
  newTracked,
  wasTracked
} from './dep'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

// The number of effects currently being tracked recursively.
let effectTrackDepth = 0

export let trackOpBit = 1

/**
 * The bitwise track markers support at most 30 levels op recursion.
 * This value is chosen to enable modern JS engines to use a SMI on all platforms.
 * When recursion depth is greater, fall back to using a full cleanup.
 */
const maxMarkerBits = 30

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
  effect: ReactiveEffect
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

const effectStack: ReactiveEffect[] = []
let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

// VUENEXT-响应式实现原理 8.1-创建副作用函数实例(ReactiveEffect)
export class ReactiveEffect<T = any> {
  active = true
  // 在 [5.2] 我们把 dep 添加到了 effect 的 deps 中，这样达到了一个互相引用的效果。便于 cleanupEffect 后续的清理工作。
  // dep 存储着使用到此 key 的 effect 函数。
  // effect 函数的 deps 存储着使用到它的 dep
  deps: Dep[] = []

  // can be attached after creation
  computed?: boolean
  allowRecurse?: boolean
  onStop?: () => void
  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  constructor(
    // 副作用回调
    public fn: () => T,
    // 调度执行配置，在 [7.3] 判断执行的时机，此功能应用非常广泛。
    // 调度执行：在执行副作用函数的时候，由用户决定副作用函数的执行的时机和方式。
    // 简单的说就是用户配置了回调就调用用户的配置的回调，用户可以在回调里执行另外的逻辑。
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope | null
  ) {
    // effectScope 相关处理逻辑
    recordEffectScope(this, scope)
  }

  // 执行
  run() {
    if (!this.active) {
      return this.fn()
    }
    if (!effectStack.includes(this)) {
      try {
        // 为什么要设计一个栈的结构？为了解决嵌套 effect 的场景
        // Case:
        // effect1(() => { activeEffect = effect1
        //   effect2(() => { activeEffect = effect2
        //     obj.a // 直接收集
        //   })
        //   obj.b // 这时也执行依赖收集，但是 activeEffect = effect2 所以要回退
        // })
        // 设置激活 activeEffect
        effectStack.push((activeEffect = this))

        // 开启全局 shouldTrack，允许依赖收集
        enableTracking()

        // VUETODO 3.2.x 优化
        trackOpBit = 1 << ++effectTrackDepth
        if (effectTrackDepth <= maxMarkerBits) {
          initDepMarkers(this)
        } else {
          // 清理依赖
          cleanupEffect(this)
        }

        // 执行原始函数
        return this.fn()
      } finally {
        // VUETODO 3.2.x 优化
        if (effectTrackDepth <= maxMarkerBits) {
          finalizeDepMarkers(this)
        }
        trackOpBit = 1 << --effectTrackDepth

        // 恢复 shouldTrack 开启之前的状态
        resetTracking()
        // 出栈
        effectStack.pop()
        // 指向栈最后一个 effect
        const n = effectStack.length
        activeEffect = n > 0 ? effectStack[n - 1] : undefined
      }
    }
  }

  // 清理所有的依赖不在监听
  stop() {
    if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

// 如果一个 effect 从新执行，那么此 effect 下的所有的响应式的 key 都要重新收集依赖。
// 因为 dep 是一个 Set 所以不用考虑重复问题，要考虑比如在一个 v-if 判断里：
//   - 如果条件为 true 时 if 块里的值收集了依赖。
//   - 但后续变为了 false 那么在 if 块里的值之前收集的依赖应该清除，此时再取更新值就会造成无意义的更新。
function cleanupEffect(effect: ReactiveEffect) {
  // 取出此 effect 下所有 dep
  const { deps } = effect
  if (deps.length) {
    // 清理 dep 里所有的 effect 函数
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
  scope?: EffectScope
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

// VUENEXT-响应式实现原理 8-副作用函数(effect)
// 现在还没说我们一直收集和执行 activeEffect 是怎么来的。
// Case:
// const o = {name: 'lian'}
// const p = Proxy(0, {})
// effect(() => {
//   p.name
// })
// p.name = 'lhw'
// 1、我们运行了一个 effect 函数。
// 2、当在执行 effect 函数回调的过程中访问到响应式数据的时候。
// 3、发生取值触发 get 函数，执行 track 收集 activeEffect。
// 4、设置设置触发 set 函数，执行 trigger 执行收集的 effect。
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }
  // 创建 _effect 实例
  const _effect = new ReactiveEffect(fn)
  if (options) {
    // 拷贝 options 中的属性到 _effect 中
    extend(_effect, options)
    // effectScope 相关处理逻辑
    if (options.scope) recordEffectScope(_effect, options.scope)
  }
  // 如果没有配置 lazy 则立即执行
  if (!options || !options.lazy) {
    _effect.run()
  }
  // 绑定 run 函数，作为 effect runner
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  // runner 中保留对 _effect 的引用
  runner.effect = _effect
  return runner
}

export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
}

let shouldTrack = true
const trackStack: boolean[] = []

export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

// VUENEXT-响应式实现原理 5-依赖收集过程(track)
// 四个全局的变量：
// 1、是否应该收集依赖 ==> let shouldTrack = true
// 2、嵌套的 effect 栈 ==> const trackStack = []
// 3、当前激活的 effect ==> let activeEffect
// 4、原始数据对象 map ==> const targetMap = new WeakMap()
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (!isTracking()) {
    return
  }
  // VUENEXT-响应式实现原理 5.1-创建对应的依赖结构
  // WeakMap({ // -- 以代理对象为 key 创建一个 Map
  //   [target]: Map({ // -- 以代理对象的 key 创建一个 Set
  //     [key]: Set([effect1, effect2]) // -- 以 key 存储关联的 effect
  //   })
  // })
  // 1、每个 target 对应一个 depsMap，不存在创建。
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  // 2、每个 key 对应一个 dep 集合，不存在创建。
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  const eventInfo = __DEV__
    ? { effect: activeEffect, target, type, key }
    : undefined

  trackEffects(dep, eventInfo)
}

export function isTracking() {
  return shouldTrack && activeEffect !== undefined
}

export function trackEffects(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  let shouldTrack = false
  if (effectTrackDepth <= maxMarkerBits) {
    // VUETODO 3.2.x 优化
    if (!newTracked(dep)) {
      dep.n |= trackOpBit // set newly tracked
      shouldTrack = !wasTracked(dep)
    }
  } else {
    // Full cleanup mode.
    // 此 effect 是否已经收集过
    shouldTrack = !dep.has(activeEffect!)
  }

  // VUENEXT-响应式实现原理 5.2-收集当前运行的副作用函数
  if (shouldTrack) {
    // 添加当前的 effect 函数
    dep.add(activeEffect!)
    // 同时把当前 dep 添加为 effect 的依赖，这样做是为了知道当前的 effect 都被谁收集了便于后续清理使用。
    activeEffect!.deps.push(dep)
    if (__DEV__ && activeEffect!.onTrack) {
      activeEffect!.onTrack(
        Object.assign(
          {
            effect: activeEffect!
          },
          debuggerEventExtraInfo
        )
      )
    }
  }
}

// VUENEXT-响应式实现原理 7-派发通知(trigger)
// 四个全局的变量同上
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  // VUENEXT-响应式实现原理 7.1 获取所有的依赖集合
  // 1、通过 targetMap 拿到 target 对应的依赖集合
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // 没有依赖，直接返回
    return
  }

  // 3、根据 key 从 depsMap 中找到对应和相关的依赖集合
  // 收集依赖的时候不仅仅只有 key 相关的，如果是数组还有 length 的依赖 和 for ... of 时的依赖。
  let deps: (Dep | undefined)[] = []
  if (type === TriggerOpTypes.CLEAR) {
    // 取出集合收集副作用函数
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    // 取出数组 length 收集的副作用函数
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        deps.push(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    // SET | ADD | DELETE 操作之一
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      // 添加
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY)) // Array 遍历指定的 key
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY)) // Map 遍历指定的 key
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get('length'))
        }
        break
      // 删除
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      // 修改
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  const eventInfo = __DEV__
    ? { target, type, key, newValue, oldValue, oldTarget }
    : undefined

  // VUENEXT-响应式实现原理 7.2 获取所有的 effects 集合
  if (deps.length === 1) {
    // 只有一个直接获取
    if (deps[0]) {
      if (__DEV__) {
        triggerEffects(deps[0], eventInfo)
      } else {
        triggerEffects(deps[0])
      }
    }
  } else {
    // 多个就把二维数组转成平级
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    if (__DEV__) {
      triggerEffects(createDep(effects), eventInfo)
    } else {
      // 执行 effects
      triggerEffects(createDep(effects))
    }
  }
}

export function triggerEffects(
  dep: Dep | ReactiveEffect[],
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  // spread into array for stabilization
  for (const effect of isArray(dep) ? dep : [...dep]) {
    if (effect !== activeEffect || effect.allowRecurse) {
      if (__DEV__ && effect.onTrigger) {
        effect.onTrigger(extend({ effect }, debuggerEventExtraInfo))
      }
      // VUENEXT-响应式实现原理 7.3 直接执行与调度执行
      if (effect.scheduler) {
        // 调度执行：在执行副作用函数的时候，由用户决定副作用函数的执行的时机和方式。
        // 简单的说就是用户配置了回调就调用用户的配置的回调，用户可以在回调里运行 effect.run()
        effect.scheduler()
      } else {
        // 直接运行
        effect.run()
      }
    }
  }
}
