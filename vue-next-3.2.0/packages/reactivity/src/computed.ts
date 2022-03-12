import { DebuggerOptions, ReactiveEffect } from './effect'
import { Ref, trackRefValue, triggerRefValue } from './ref'
import { isFunction, NOOP } from '@vue/shared'
import { ReactiveFlags, toRaw } from './reactive'
import { Dep } from './dep'

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>
}

export type ComputedGetter<T> = (...args: any[]) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

// VUENEXT-计算属性 2-创建 Computed 实例
class ComputedRefImpl<T> {
  // 自身存储的依赖
  public dep?: Dep = undefined

  // 原始值
  private _value!: T
  // 依赖的值是否改变
  private _dirty = true
  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true
  public readonly [ReactiveFlags.IS_READONLY]: boolean

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean
  ) {
    // VUENEXT-计算属性 3-创建副作用函数
    // 默认不执行，返回一个函数，当访问的时候并且代理的数据变化的时候再执行。
    // 当执行 getter 的时候，当前的 activeEffect 就是 getter。
    // 执行函数内部访问代理对象就会触发 get 就会把 getter 函数收集成依赖。
    // 注意：这里传入了第二个参数利用了调度执行也就是不会立即 effect.run()
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        // 依赖的值改变了需要重新运算
        this._dirty = true
        // 派发通知
        triggerRefValue(this)
      }
    })
    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  get value() {
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    // 只有当我们访问计算属性的时候，它才会真正运行 computed getter 函数计算；
    // 只要依赖的值不变化，就可以使用缓存的 value 而不用每次在渲染组件的时候都执行函数去计算
    const self = toRaw(this)
    // 依赖收集
    trackRefValue(self)
    if (self._dirty) {
      self._dirty = false
      // 只有值改变了才从新运行获取最新值
      self._value = self.effect.run()!
    }
    return self._value
  }

  set value(newValue: T) {
    this._setter(newValue)
  }
}

// VUENEXT-计算属性 1-计算属性
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions
): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
) {
  // getter 函数
  let getter: ComputedGetter<T>
  // setter 函数
  let setter: ComputedSetter<T>

  if (isFunction(getterOrOptions)) {
    // 表面传入的是 getter 函数，不能修改计算属性的值
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          console.warn('Write operation failed: computed value is readonly')
        }
      : NOOP
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  // 创建实例
  const cRef = new ComputedRefImpl(
    getter,
    setter,
    isFunction(getterOrOptions) || !getterOrOptions.set
  )

  if (__DEV__ && debugOptions) {
    cRef.effect.onTrack = debugOptions.onTrack
    cRef.effect.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
