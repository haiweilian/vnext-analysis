### 什么是命令式和声明式？

命令式注重的是**过程**，一行代码一个命令直到结果。

```js
const dom = document.createElement("div");
dom.innerText = "hello word";
dom.addEventListener("click", () => alert(1));
document.body.appendChild(dom);
```

声明式注重的是**结果**，直接写出结果。

```html
<div @click="() => alert(1)">hello word</div>
```

### 虚拟 DOM 的性能怎样？

[尤大讲解虚拟 DOM 的本质，虚拟 DOM 一定比真实 DOM 更快吗？](https://www.zhihu.com/question/31809713/answer/53544875)

1、虚拟 DOM 的表现：是用 JS 对象描述 DOM 节点。

2、虚拟 DOM 的出现：是为了减少最小化的更新差异。

3、虚拟 DOM 可以作为一个中间角色：可以渲染到其他端(跨端)。DOM => 虚拟 DOM => 目标端。
