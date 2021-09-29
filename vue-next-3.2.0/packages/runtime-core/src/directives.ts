/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return withDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/

import { VNode } from './vnode'
import { isFunction, EMPTY_OBJ, makeMap } from '@vue/shared'
import { warn } from './warning'
import { ComponentInternalInstance, Data } from './component'
import { currentRenderingInstance } from './componentRenderContext'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling'
import { ComponentPublicInstance } from './componentPublicInstance'
import { mapCompatDirectiveHook } from './compat/customDirective'
import { pauseTracking, resetTracking } from '@vue/reactivity'
import { traverse } from './apiWatch'

export interface DirectiveBinding<V = any> {
  instance: ComponentPublicInstance | null
  value: V
  oldValue: V | null
  arg?: string
  modifiers: DirectiveModifiers
  dir: ObjectDirective<any, V>
}

export type DirectiveHook<T = any, Prev = VNode<any, T> | null, V = any> = (
  el: T,
  binding: DirectiveBinding<V>,
  vnode: VNode<any, T>,
  prevVNode: Prev
) => void

export type SSRDirectiveHook = (
  binding: DirectiveBinding,
  vnode: VNode
) => Data | undefined

export interface ObjectDirective<T = any, V = any> {
  created?: DirectiveHook<T, null, V>
  beforeMount?: DirectiveHook<T, null, V>
  mounted?: DirectiveHook<T, null, V>
  beforeUpdate?: DirectiveHook<T, VNode<any, T>, V>
  updated?: DirectiveHook<T, VNode<any, T>, V>
  beforeUnmount?: DirectiveHook<T, null, V>
  unmounted?: DirectiveHook<T, null, V>
  getSSRProps?: SSRDirectiveHook
  deep?: boolean
}

export type FunctionDirective<T = any, V = any> = DirectiveHook<T, any, V>

export type Directive<T = any, V = any> =
  | ObjectDirective<T, V>
  | FunctionDirective<T, V>

export type DirectiveModifiers = Record<string, boolean>

// 是否和内部指令冲突
const isBuiltInDirective = /*#__PURE__*/ makeMap(
  'bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text'
)

export function validateDirectiveName(name: string) {
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}

// Directive, value, argument, modifiers
export type DirectiveArguments = Array<
  | [Directive]
  | [Directive, any]
  | [Directive, any, string]
  | [Directive, any, string, DirectiveModifiers]
>

/**
 * Adds directives to a VNode.
 */
// VUENEXT-Directive 3-应用指令
export function withDirectives<T extends VNode>(
  vnode: T,
  directives: DirectiveArguments
): T {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return vnode
  }

  const instance = internalInstance.proxy
  // 处理所有的指令，保存在 dirs 里。
  const bindings: DirectiveBinding[] = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i]
    // 如果是一个函数是简写，直接放到 mounted updated 生命周期里，只在挂载和更新时调用。
    if (isFunction(dir)) {
      dir = {
        mounted: dir,
        updated: dir
      } as ObjectDirective
    }
    if (dir.deep) {
      traverse(value)
    }
    bindings.push({
      dir,
      instance,
      // 新值
      value,
      // 旧值
      oldValue: void 0,
      // 参数
      arg,
      // 修饰符
      modifiers
    })
  }
  return vnode
}

// VUENEXT-Directive 4.1-执行指令钩子
// 遍历所有的指令，并获取对应的钩子函数执行。
export function invokeDirectiveHook(
  // 新组件
  vnode: VNode,
  // 旧组件
  prevVNode: VNode | null,
  // 组件实例
  instance: ComponentInternalInstance | null,
  // 钩子名称
  name: keyof ObjectDirective
) {
  const bindings = vnode.dirs!
  const oldBindings = prevVNode && prevVNode.dirs!
  // 遍历指令数组
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value
    }
    // 获取对应的钩子函数
    let hook = binding.dir[name] as DirectiveHook | DirectiveHook[] | undefined
    if (__COMPAT__ && !hook) {
      hook = mapCompatDirectiveHook(name, binding.dir, instance)
    }
    // 执行对应的钩子函数
    if (hook) {
      // disable tracking inside all lifecycle hooks
      // since they can potentially be called inside effects.
      pauseTracking()
      callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, [
        vnode.el,
        binding,
        vnode,
        prevVNode
      ])
      resetTracking()
    }
  }
}
