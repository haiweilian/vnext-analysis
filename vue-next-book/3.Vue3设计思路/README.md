### 组件的本质是什么?

组件的本质是对一组 DOM 元素的封装。`Component` 是一个组件，里面封装了一组元素。

```jsx
const Component = () => {
  return (
    <div>
      <button>click me</button>
    </div>
  );
};
```

### Vue 由那几个核心模块组成？

> 每个模块的详细作用等看完全部再回头思考。

1、编译器(compiler-x)：把模板编译成渲染函数，返回虚拟 DOM。

2、渲染器(runtime-x)：把虚拟 DOM 渲染成真实的 DOM 节点。

3、响应系统(reactivity)：收集依赖并在数据变更的时候重新执行渲染器。
