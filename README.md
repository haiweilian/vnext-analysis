# vnext-analysis

此项目是在研究 Vue3 体系的源码分析的总结记录。现有 200+ 流程标记、20+ 思维导图、2+ Mini 版实现。

由于已经看完此书了，所以推荐一本书[《Vue.js 设计与实现》](https://book.douban.com/subject/35768338)。书中讲的比较简单易懂可以理解核心概念和实现，另外我也完善了此项目的代码注释和流程标记。目录分类现在按照书的目录从新分类了，可以看完一大篇之后直接来看具体的源码这样也会理解的更深入点。

### 体系进度

- [x] Vue 3.2.0
- [x] Vue-Router 4.0.0
- [x] Vuex 4.0.0
- [x] Pinia 2.0.0
- [x] HcySunYang《Vue.js 设计与实现》

### 流程标记

我一直想把流程调试过程中的主要断点保存下来，以便后续再次看的时候能轻松的找到不过没找到方案。现在使用了 `VsCode` 的 [Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) 符合心中的预期，能高亮、能过滤、能搜索，如果需要调试就在浏览器对应的位置打上断点。

为什么给每个主要流程打上标记，因为在这么大的源码库里方法和文件来回跳转很正常不过了。如果这样就可以根据打的标记走，在研究分支细节的时候也能轻松回到主流程。

![1.1.流程标记](./.docs/1.1.流程标记.png)

![1.2.流程标记](./.docs/1.2.流程标记.png)

### 测试例子

如果调试测试例子是必不可少，所有都写了简单的用例。涉及编译部分都是先写模板的方式测试，然后通过 [template-explorer](https://vue-next-template-explorer.netlify.app/) 编译，再根据编译结果手写渲染函数的方式实现。

![2.1.测试例子](./.docs/2.1.测试例子.png)

### 思维导图

在理解完一个功能实现后，都会重新梳理流程，把重要的点和调用关系图用思维导图的方式呈现出来用于加强理解。

![3.1.思维导图](./.docs/3.1.思维导图.png)

![响应式实现原理](./vue-next-xmind/part.2.reactivity/1.响应式实现原理.png)

### 简易实现

理解核心功能，实现简易的版本实现，目前实现了两个 _响应式原理_ 和 _DIFF 算法原理_。

![4.1.Mini](./.docs/4.1.Mini.png)

![4.2.Mini](./.docs/4.2.Mini.png)

### 参考资料

感谢所有社区优秀资源的贡献者们。

[Vue3 设计与实现](https://www.ituring.com.cn/book/2953)

[Vue3 核心源码解析](https://ustbhuangyi.github.io/vue-analysis/v3/new/)
