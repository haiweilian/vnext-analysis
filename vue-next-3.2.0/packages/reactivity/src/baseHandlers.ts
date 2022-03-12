import {
  reactive,
  readonly,
  toRaw,
  ReactiveFlags,
  Target,
  readonlyMap,
  reactiveMap,
  shallowReactiveMap,
  shallowReadonlyMap
} from './reactive'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import {
  track,
  trigger,
  ITERATE_KEY,
  pauseTracking,
  resetTracking
} from './effect'
import {
  isObject,
  hasOwn,
  isSymbol,
  hasChanged,
  isArray,
  isIntegerKey,
  extend,
  makeMap
} from '@vue/shared'
import { isRef } from './ref'

const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => (Symbol as any)[key])
    .filter(isSymbol)
)

const get = /*#__PURE__*/ createGetter()
const shallowGet = /*#__PURE__*/ createGetter(false, true)
const readonlyGet = /*#__PURE__*/ createGetter(true)
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true)

const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  // 对查询方法做处理，如果值经过代理转换，再用原始值就查询不到了。
  // Case:
  //  const obj = {};
  //  const arr = reactive([obj]);
  //  arr.includes(obj); // false
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any
      for (let i = 0, l = this.length; i < l; i++) {
        // 对数组的每一项做依赖收集
        track(arr, TrackOpTypes.GET, i + '')
      }
      // we run the method using the original args first (which may be reactive)
      const res = arr[key](...args)
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
        return arr[key](...args.map(toRaw))
      } else {
        return res
      }
    }
  })
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  // 因为数组的方法会在修改的同时访问 `length` 属性的时候同时收集依赖，
  // 当调用第一个副作用的时候改变 `length` 就会执行第二个副作用，当调用第二个副作用的时候改变 `length` 又会执行一个副作用造成死循环。
  // 所以重写 `push`、`pop` 等方法，放弃对 `length` 依赖的收集，在调用方法之前停止收集执行完在开始收集。
  // Case:
  //  const arr = reactive([]);
  //  两个 effect 造成冲突导致内存溢出
  //  effect(() => {
  //     arr.push(1);
  //  });
  //  effect(() => {
  //    arr.push(2);
  //  });
  ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      // 停止依赖收集
      pauseTracking()
      const res = (toRaw(this) as any)[key].apply(this, args)
      // 重置依赖收集
      resetTracking()
      return res
    }
  })
  return instrumentations
}

// VUENEXT-响应式实现原理 4-代理 get 函数
// isReadonly 表示是否只读的，不会做代理
// shallow 表示是浅响应，如果浅响应则不会递归代理
function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    // VUENEXT-响应式实现原理 4.1-对特殊的 key 做代理
    if (key === ReactiveFlags.IS_REACTIVE) {
      // 当访问 observed.__v_isReactive 返回是否是已经是响应式对象
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      // 当访问 observed.__v_isReadonly 返回是否是只读的
      return isReadonly
    } else if (
      // 当访问 observed.__v_raw 返回原始对象
      key === ReactiveFlags.RAW &&
      receiver ===
        (isReadonly
          ? shallow
            ? shallowReadonlyMap
            : readonlyMap
          : shallow
          ? shallowReactiveMap
          : reactiveMap
        ).get(target)
    ) {
      return target
    }

    // VUENEXT-响应式实现原理 4.2-如果是数组，对函数方法做处理。
    const targetIsArray = isArray(target)
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }

    // VUENEXT-响应式实现原理 4.3-通过 Reflect.* 访问
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect
    // 因为 `Proxy` 代理对象指定的拦截函数是自定义对象本身的内部方法和行为（也就是我们把内部函数覆盖了）。
    // 而 `Reflect` 提供了与 `Proxy` 内部相同的方法，所以我们在自定义方法的同时要保持原始的行为。
    const res = Reflect.get(target, key, receiver)
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // VUENEXT-响应式实现原理 4.4-依赖收集调用(track)
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    if (shallow) {
      return res
    }

    if (isRef(res)) {
      // ref unwrapping - does not apply for Array + integer key.
      const shouldUnwrap = !targetIsArray || !isIntegerKey(key)
      return shouldUnwrap ? res.value : res
    }

    if (isObject(res)) {
      // Convert returned value into a proxy as well. we do the isObject check
      // here to avoid invalid value warning. Also need to lazy access readonly
      // and reactive here to avoid circular dependency.
      // VUENEXT-响应式实现原理 4.5-如果是对象，则递归执行响应式。回到 第 【1】步。
      // 在 Vue2 中，是在初始化阶段，即定义劫持对象的时候就已经递归执行了
      // 在 Vue3 中，是在对象被访问的时候才递归执行下一步 reactive，延迟定义响应式的方式也提升性能。
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

const set = /*#__PURE__*/ createSetter()
const shallowSet = /*#__PURE__*/ createSetter(true)

// VUENEXT-响应式实现原理 6-代理 set 函数
function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    // ref 自动设置 value
    let oldValue = (target as any)[key]
    if (!shallow) {
      value = toRaw(value)
      oldValue = toRaw(oldValue)
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
    }

    // 是否已经包含设置的 key
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(target, key, value, receiver)

    // don't trigger if target is something up in the prototype chain of original
    // 如果目标的原型链也是一个 proxy，通过 Reflect.set 修改原型链上的属性会再次触发 setter，这种情况下就没必要触发两次 trigger
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // 不存在是新添加
        // 派发通知：添加操作类型
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        // 存在先对比值是否变化了，没变化就没必要更新
        // 派发通知：更新操作类型，包含旧值
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }
}

function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = (target as any)[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}

function ownKeys(target: object): (string | symbol)[] {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}

// VUENEXT-响应式实现原理 3.1-定义代理配置
// 通过 Proxy 劫持 target 对象做一些操作。
// 1、访问对象属性会触发 get 函数；
// 2、设置对象属性会触发 set 函数；
// 3、删除对象属性会触发 deleteProperty 函数；
// 4、in 操作符会触发 has 函数；
// 5、通过 Object.getOwnPropertyNames 访问对象属性名会触发 ownKeys 函数。
export const mutableHandlers: ProxyHandler<object> = {
  // (obj.name) 执行
  get,
  // (obj.name = 'lian') 执行
  set,
  // (delete name) 执行
  deleteProperty,
  // ('name' in obj) 执行
  has,
  // (for(key in obj)) 执行
  ownKeys
}

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}

export const shallowReactiveHandlers = /*#__PURE__*/ extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers = /*#__PURE__*/ extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)
