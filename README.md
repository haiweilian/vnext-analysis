# vnext-analysis

此项目是在研究 Vue3 体系的源码分析的总结记录。现有 200+ 流程标记、20+ 思维导图、2+ Mini 版实现。

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

### 调试配置

学习源码调试和列子是必不可少的，所以项目中调试配置都已集成，可以看 [调试配置](https://github.com/haiweilian/vnext-analysis/issues/1) 中的详情说明。

![2.1.调试配置](./.docs/2.1.调试配置.png)
![2.1.调试配置](./.docs/2.2.调试配置.png)

### 思维导图

在理解完一个功能实现后，都会重新梳理流程，把重要的点和调用关系图用思维导图的方式呈现出来用于加强理解。

![思维导图](./.docs/3.1.思维导图.png)

![响应式实现原理](./vue-next-xmind/part.2.reactivity/1.响应式实现原理.png)

### 简易实现

理解核心功能，实现简易的版本实现，目前实现了两个 _响应式原理_ 和 _DIFF 算法原理_。

![4.1.Mini](./.docs/4.1.Mini.png)

![4.2.Mini](./.docs/4.2.Mini.png)

### 参考资料

感谢所有社区优秀资源的贡献者们。

[Vue3 设计与实现](https://www.ituring.com.cn/book/2953)

[Vue3 核心源码解析](https://ustbhuangyi.github.io/vue-analysis/v3/new/)
