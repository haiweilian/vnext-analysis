import { effect, ReactiveEffect, trigger, track } from './effect'
import { TriggerOpTypes, TrackOpTypes } from './operations'
import { Ref } from './ref'
import { isFunction, NOOP } from '@vue/shared'
import { ReactiveFlags, toRaw } from './reactive'

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>
}

export type ComputedGetter<T> = (ctx?: any) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

class ComputedRefImpl<T> {
  // 计算结果
  private _value!: T
  // 数据是否脏的(是否改变)
  private _dirty = true

  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean
  ) {
    // VUENEXT-计算属性 2-创建副作用函数
    // 默认不执行，返回一个函数，当访问的时候并且依赖变化的时候再执行。
    // 当执行 getter 的时候，当前的 activeEffect 就是 getter。
    // 执行函数内部的 ref 触发了 get 就会把 getter 函数收集成依赖。
    // 这样当 ref 变化的时候就会触发 getter 函数。
    this.effect = effect(getter, {
      // 默认不执行
      lazy: true,
      // 调度执行的实现
      scheduler: () => {
        if (!this._dirty) {
          // 值改变了
          this._dirty = true
          // 派发通知，自己本身被作为依赖，也是一种扩展行为。
          trigger(toRaw(this), TriggerOpTypes.SET, 'value')
        }
      }
    })

    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  get value() {
    // 只有当我们访问计算属性的时候，它才会真正运行 computed getter 函数计算；
    // 只要依赖不变化，就可以使用缓存的 value 而不用每次在渲染组件的时候都执行函数去计算
    if (this._dirty) {
      this._value = this.effect()
      this._dirty = false
    }
    // 依赖收集
    track(toRaw(this), TrackOpTypes.GET, 'value')
    return this._value
  }

  set value(newValue: T) {
    // 计算属性的 setter
    this._setter(newValue)
  }
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>
): WritableComputedRef<T>

// VUENEXT-计算属性 1-计算属性
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
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

  return new ComputedRefImpl(
    getter,
    setter,
    isFunction(getterOrOptions) || !getterOrOptions.set
  ) as any
}
