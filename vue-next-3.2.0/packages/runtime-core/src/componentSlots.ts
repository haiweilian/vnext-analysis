import { ComponentInternalInstance, currentInstance } from './component'
import {
  VNode,
  VNodeNormalizedChildren,
  normalizeVNode,
  VNodeChild,
  InternalObjectKey
} from './vnode'
import {
  isArray,
  isFunction,
  EMPTY_OBJ,
  ShapeFlags,
  extend,
  def,
  SlotFlags
} from '@vue/shared'
import { warn } from './warning'
import { isKeepAlive } from './components/KeepAlive'
import { ContextualRenderFn, withCtx } from './componentRenderContext'
import { isHmrUpdating } from './hmr'
import { DeprecationTypes, isCompatEnabled } from './compat/compatConfig'
import { toRaw } from '@vue/reactivity'

export type Slot = (...args: any[]) => VNode[]

export type InternalSlots = {
  [name: string]: Slot | undefined
}

export type Slots = Readonly<InternalSlots>

export type RawSlots = {
  [name: string]: unknown
  // manual render fn hint to skip forced children updates
  $stable?: boolean
  /**
   * for tracking slot owner instance. This is attached during
   * normalizeChildren when the component vnode is created.
   * @internal
   */
  _ctx?: ComponentInternalInstance | null
  /**
   * indicates compiler generated slots
   * we use a reserved property instead of a vnode patchFlag because the slots
   * object may be directly passed down to a child component in a manual
   * render function, and the optimization hint need to be on the slot object
   * itself to be preserved.
   * @internal
   */
  _?: SlotFlags
}

const isInternalKey = (key: string) => key[0] === '_' || key === '$stable'

// VUENEXT-Slot 3.3-标准化插槽组件(数组)
const normalizeSlotValue = (value: unknown): VNode[] =>
  isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value as VNodeChild)]

const normalizeSlot = (
  key: string,
  rawSlot: Function,
  ctx: ComponentInternalInstance | null | undefined
): Slot => {
  // VUENEXT-Slot 3.2-设置插槽上下文
  // 1、调用 withCtx 函数，返回一个新的函数 renderFnWithContext，用闭包保存当前上下文和参数
  // 2、当调用 ctx.slots.default({ text: "default" }) 时，调用 renderFnWithContext。
  // 3、设置当前上下文为定义时的上下文，也就是执行 render 函数时的当前组件实例，保证在子组件中渲染具体插槽内容时，它的渲染组件实例是父组件实例（父级模板里的所有内容都是在父级作用域中编译的）
  // 4、渲染插槽并传入参数。(作用域插槽，对应 v-slot ，这样可以在父组件取到子组件传入的值)
  // 5、标准化 vnode。
  // 5、执行完毕后回复上下文。（子模板里的所有内容都是在子作用域中编译的。）
  const normalized = withCtx((props: any) => {
    if (__DEV__ && currentInstance) {
      warn(
        `Slot "${key}" invoked outside of the render function: ` +
          `this will not track dependencies used in the slot. ` +
          `Invoke the slot function inside the render function instead.`
      )
    }
    return normalizeSlotValue(rawSlot(props))
  }, ctx) as Slot
  // NOT a compiled slot
  ;(normalized as ContextualRenderFn)._c = false
  return normalized
}

const normalizeObjectSlots = (
  rawSlots: RawSlots,
  slots: InternalSlots,
  instance: ComponentInternalInstance
) => {
  const ctx = rawSlots._ctx
  for (const key in rawSlots) {
    if (isInternalKey(key)) continue
    const value = rawSlots[key]
    if (isFunction(value)) {
      // VUENEXT-Slot 3.1-标准化插槽(函数)
      // 如果是一个函数，
      slots[key] = normalizeSlot(key, value, ctx)
    } else if (value != null) {
      if (
        __DEV__ &&
        !(
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance)
        )
      ) {
        warn(
          `Non-function value encountered for slot "${key}". ` +
            `Prefer function slots for better performance.`
        )
      }
      // 不是一个函数，转化成函数
      const normalized = normalizeSlotValue(value)
      slots[key] = () => normalized
    }
  }
}

const normalizeVNodeSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren
) => {
  if (
    __DEV__ &&
    !isKeepAlive(instance.vnode) &&
    !(__COMPAT__ && isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance))
  ) {
    warn(
      `Non-function value encountered for default slot. ` +
        `Prefer function slots for better performance.`
    )
  }
  const normalized = normalizeSlotValue(children)
  instance.slots.default = () => normalized
}

export const initSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren
) => {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      // users can get the shallow readonly version of the slots object through `this.$slots`,
      // we should avoid the proxy object polluting the slots of the internal instance
      // 把插槽保存到 instance.slots 上
      instance.slots = toRaw(children as InternalSlots)
      // make compiler marker non-enumerable
      def(children as InternalSlots, '_', type)
    } else {
      // VUENEXT-Slot 3-标准化插槽
      normalizeObjectSlots(
        children as RawSlots,
        (instance.slots = {}),
        instance
      )
    }
  } else {
    // 最终都会保存到 instance.slots 上
    instance.slots = {}
    if (children) {
      normalizeVNodeSlots(instance, children)
    }
  }
  def(instance.slots, InternalObjectKey, 1)
}

export const updateSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
  optimized: boolean
) => {
  const { vnode, slots } = instance
  let needDeletionCheck = true
  let deletionComparisonTarget = EMPTY_OBJ
  if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      // compiled slots.
      if (__DEV__ && isHmrUpdating) {
        // Parent was HMR updated so slot content may have changed.
        // force update slots and mark instance for hmr as well
        extend(slots, children as Slots)
      } else if (optimized && type === SlotFlags.STABLE) {
        // compiled AND stable.
        // no need to update, and skip stale slots removal.
        needDeletionCheck = false
      } else {
        // compiled but dynamic (v-if/v-for on slots) - update slots, but skip
        // normalization.
        extend(slots, children as Slots)
        // #2893
        // when rendering the optimized slots by manually written render function,
        // we need to delete the `slots._` flag if necessary to make subsequent updates reliable,
        // i.e. let the `renderSlot` create the bailed Fragment
        if (!optimized && type === SlotFlags.STABLE) {
          delete slots._
        }
      }
    } else {
      needDeletionCheck = !(children as RawSlots).$stable
      normalizeObjectSlots(children as RawSlots, slots, instance)
    }
    deletionComparisonTarget = children as RawSlots
  } else if (children) {
    // non slot object children (direct value) passed to a component
    normalizeVNodeSlots(instance, children)
    deletionComparisonTarget = { default: 1 }
  }

  // delete stale slots
  if (needDeletionCheck) {
    for (const key in slots) {
      if (!isInternalKey(key) && !(key in deletionComparisonTarget)) {
        delete slots[key]
      }
    }
  }
}
