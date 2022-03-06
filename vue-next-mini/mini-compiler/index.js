// ================================================================================
// 解析字符串生成模板 AST
// ================================================================================
const template = `<div class="home">Hello {{title}}</div>`;
// const template = `<div class="home"><h4>Hello {{title}}</h4><span>mini-compiler</span></div>`;

/**
 * 解析入口
 * @param {*} str 模板字符串
 */
function parse(str) {
  // 运行时的上下文
  const context = {
    // 源字符串在解析过程中不断减少
    source: str,
    // 前进 num 个字符
    advanceBy(num) {
      context.source = context.source.slice(num);
    },
    // 前进连续的 n 个空格
    advanceSpaces() {
      const match = /^[\t\r\n\f ]+/.exec(context.source);
      if (match) {
        context.advanceBy(match[0].length);
      }
    },
  };

  // 开始解析节点
  const nodes = parseChildren(context, []);

  return {
    type: "Root",
    children: nodes,
  };
}

/**
 * 解析子节点
 * @param {*} context 上下文
 * @param {*} ancestors 父节点栈
 */
function parseChildren(context, ancestors) {
  let nodes = [];

  while (!isEnd(context, ancestors)) {
    let node = null;
    if (context.source[0] === "<") {
      // 标签 < 开头 // <div...
      node = parseElement(context, ancestors);
    } else if (context.source.startsWith("{{")) {
      // 解析插值 `{{title}}</div>`
      node = parseInterpolation(context);
    }

    // 不存在匹配的类型解析为文本
    if (!node) {
      // `Hello {{title}}</div>`
      node = parseText(context);
    }

    nodes.push(node);
  }

  return nodes;
}

/**
 * 解析元素
 */
function parseElement(context, ancestors) {
  // 解析标签
  const element = parseTag(context);
  ancestors.push(element);

  // 递归子节点
  element.children = parseChildren(context, ancestors);
  ancestors.pop();

  // 子节点解析结束
  if (context.source.startsWith(`</${element.tag}`)) {
    // 消费对应的闭合标签
    parseTag(context, "end");
  }

  return element;
}

/**
 * 解析标签名称
 */
function parseTag(context, type = "start") {
  const { advanceBy, advanceSpaces } = context;

  // 匹配标签名称
  let match = null;
  if (type === "start") {
    // /^<([a-z][^\t\r\n\f />]*)/i.exec(`<div class="home">Hello {{title}}</div>`) ==> ['<div', 'div']
    match = /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source);
  } else {
    // /^<([a-z][^\t\r\n\f />]*)/i.exec(`</div>`) ==> ['</div', 'div']
    match = /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source);
  }

  // 消费标签
  advanceBy(match[0].length);
  // 消费空格
  advanceSpaces();
  // 剩余 ==> `class="home">Hello {{title}}</div>`

  // 解析属性
  const props = parseAttributes(context);

  // 消费解析属性之后的 ">"
  advanceBy(1);
  // 剩余 ==> `Hello {{title}}</div>`

  // 返回节点信息
  return {
    type: "Element",
    tag: match[1],
    props,
    children: [],
  };
}

/**
 * 解析标签属性
 */
function parseAttributes(context) {
  const { advanceBy, advanceSpaces } = context;
  const props = [];

  // 标签 "<div" 开始之后 “>” 之前的都是属性
  while (!context.source.startsWith(">")) {
    // 解析属性 key
    // /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(`class="home">Hello {{title}}</div>`) ==> ['class']
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
    const name = match[0];

    // 消费 name
    advanceBy(name.length);
    // 消费空格
    advanceSpaces();
    // 消费 = 号
    advanceBy(1);
    // 消费空格
    advanceSpaces();
    // 剩余 ==> `"home">Hello {{title}}</div>`

    // 解析属性 value
    // 消费引号 "
    advanceBy(1);
    // 截取到下一个引号之前为 value
    const value = context.source.slice(0, context.source.indexOf('"'));
    // 消费 value
    advanceBy(value.length);
    // 消费引号 "
    advanceBy(1);
    // 消费空格
    advanceSpaces();

    // 解析一个 value
    props.push({
      type: "Attribute",
      name,
      value,
    });

    // 剩余 ==> `>Hello {{title}}</、div>`
  }

  // 返回属性信息
  return props;
}

/**
 * 解析文本
 */
function parseText(context) {
  const { advanceBy, advanceSpaces } = context;

  // 在 "<" 或者 “{{” 之间的是文本，取最短的哪个
  let endIndex = context.source.length;
  const ltIndex = context.source.indexOf("<");
  const delimiterIndex = context.source.indexOf("{{");
  if (ltIndex > -1 && ltIndex < endIndex) {
    endIndex = ltIndex;
  }
  if (delimiterIndex > -1 && delimiterIndex < endIndex) {
    endIndex = delimiterIndex;
  }

  // 获取到文本
  const content = context.source.slice(0, endIndex);

  // 消费文本
  advanceBy(content.length);
  // 剩余 ==> `{{title}}</div>`

  // 返回文本信息
  return {
    type: "Text",
    content,
  };
}

/**
 * 解析插值
 */
function parseInterpolation(context) {
  const { advanceBy, advanceSpaces } = context;

  // 消费左插值符号
  advanceBy("{{".length);
  // 获取插值内容
  const closeIndex = context.source.indexOf("}}");
  const content = context.source.slice(0, closeIndex);
  // 消费插值内容
  advanceBy(content.length);
  // 消费右插值符合
  advanceBy("}}".length);
  // 剩余 ==> `</div>`

  // 返回插值信息
  return {
    type: "Interpolation",
    content,
  };
}

/**
 * 结束条件，条件是什么呢？
 */
function isEnd(context, ancestors) {
  // 没有字符串了
  if (!context.source) return true;
  // 当父节点栈中标签和现在模板中的字符形成一对则结束
  const parent = ancestors[ancestors.length - 1];
  if (parent && context.source.startsWith(`</${parent.tag}`)) return true;
}

// ================================================================================
// 根据模板 AST 生成 JS AST
// ================================================================================
/**
 * 转换
 * @param {*} ast 模板 ast
 */
function transform(ast) {
  const context = {
    // 由于我们需要对每个节点进行访问做转化，对于每种的类型转化可以拆分设计成插件
    nodeTransforms: [
      transformRoot,
      transformElement,
      transformText,
      transformInterpolation,
    ],
  };

  // 从根节点开始
  traverseNode(ast, context);
}

/**
 * 递归遍历
 */
function traverseNode(ast, context) {
  const exitFns = [];
  const transforms = context.nodeTransforms;

  // 当进入的时候我们的执行顺序先处理父节点再处理子节点，所以插件的顺序也影响处理的优先级 如 v-if 和 v-for
  for (let i = 0; i < transforms.length; i++) {
    const exitFn = transforms[i](ast, context);
    // 如果退出函数存在
    exitFn && exitFns.push(exitFn);
  }

  // 如果存在子节点递归每个子节点
  const children = ast.children;
  if (children) {
    for (let i = 0; i < children.length; i++) {
      traverseNode(children[i], context);
    }
  }

  // 我们还需退出机制，因为父节点需要等子节点处理完毕后再处理。
  // 倒序执行插件一种设计思路，这样先进入插件的退出就可以等待后进入的插件的处理结果再决定怎么处理。
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

/**
 * 创建 ast 辅助函数，与 babel ast 类似
 * 到 https://astexplorer.net 复制查看
 * function render() {
 *    return h("div", { class: "home" }, ["Hello", this.title]);
 * }
 */
// 字符串(Hello)
function createStringLiteral(value) {
  return {
    type: "StringLiteral",
    value,
  };
}
// 函数名称(h)
function createIdentifier(name) {
  return {
    type: "Identifier",
    name,
  };
}
// 函数调用(h(...))
function createCallExpression(callee, arguments) {
  return {
    type: "CallExpression",
    callee: createIdentifier(callee), // 函数名称
    arguments, // 函数参数
  };
}
// 数组([element1, element2])
function createArrayExpression(elements) {
  return {
    type: "ArrayExpression",
    elements,
  };
}
// This(this.value)
function createThisExpression(value) {
  return {
    type: "ThisExpression",
    value,
  };
}

/**
 * 转换节点工具函数
 */
// 只处理 Root 类型，并且在退出阶段，因为需要等子节点处理完毕
function transformRoot(node) {
  if (node.type !== "Root") return;
  return () => {
    node.jsNode = {
      type: "FunctionDecl",
      id: { type: "Identifier", name: "render" },
      params: [],
      body: [
        {
          type: "ReturnStatement",
          return: node.children[0].jsNode,
        },
      ],
    };
  };
}
// 只处理 Element 类型，并且在退出阶段，因为需要等子节点处理完毕
function transformElement(node) {
  if (node.type !== "Element") return;
  return () => {
    // 创建 h 函数和参数 type，props 和 children
    const callExp = createCallExpression("h", [
      // type 标签名称
      createStringLiteral(node.tag),

      // props 暂不处理
      // node.props,

      // children 获取到已处理的子节点
      createArrayExpression(node.children.map((c) => c.jsNode)),
    ]);

    node.jsNode = callExp;
  };
}
// 只处理 Text 类型
function transformText(node) {
  if (node.type !== "Text") return;
  node.jsNode = createStringLiteral(node.content);
}
// 只处理 Interpolation 类型
function transformInterpolation(node) {
  if (node.type !== "Interpolation") return;
  node.jsNode = createThisExpression(node.content);
}

// ================================================================================
// 根据 JS AST 生成 渲染函数
// ================================================================================
/**
 * 生成
 * @param {*} node JS AST
 * function render() {
 *    return h("div", { class: "home" }, ["Hello", this.title]);
 * }
 */
function generate(node) {
  const context = {
    // 拼接的代码字符串
    code: "",
    // 拼接代码
    push(code) {
      context.code += code;
    },

    // 缩进的个数根嵌套层数相关
    currentIndent: 0,
    // 换行
    newline() {
      context.code += "\n" + `  `.repeat(context.currentIndent);
    },
    // 缩进
    indent() {
      context.currentIndent++;
      context.newline();
    },
    // 删除缩进
    deIndent() {
      context.currentIndent--;
      context.newline();
    },
  };

  // 从根节点开始生成
  genNode(node, context);

  return context.code;
}

/**
 * 根据类型拼接字符
 */
function genNode(node, context) {
  switch (node.type) {
    case "FunctionDecl":
      genFunctionDecl(node, context);
      break;
    case "ReturnStatement":
      genReturnStatement(node, context);
      break;
    case "CallExpression":
      genCallExpression(node, context);
      break;
    case "StringLiteral":
      genStringLiteral(node, context);
      break;
    case "ArrayExpression":
      genArrayExpression(node, context);
      break;
    case "ThisExpression":
      genThisExpression(node, context);
      break;
  }
}
function genNodeList(nodes, context) {
  const { push } = context;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    genNode(node, context);
    if (i < nodes.length - 1) {
      push(", ");
    }
  }
}

/**
 * 生成代码辅助函数
 * function render() {
 *    return h("div", { class: "home" }, ["Hello", this.title]);
 * }
 */
// 拼接 function render() { ... }
function genFunctionDecl(node, context) {
  const { push, indent, deIndent } = context;

  // 开头 function render() {
  push(`function ${node.id.name}() {`);
  indent();

  // 加上内容
  node.body.forEach((n) => genNode(n, context));

  // 补上 }
  deIndent();
  push("}");
}
function genReturnStatement(node, context) {
  const { push, indent, deIndent } = context;

  // return
  push(`return `);

  // return 后的内容
  genNode(node.return, context);
}
function genCallExpression(node, context) {
  const { push, indent, deIndent } = context;
  const { callee, arguments: args } = node;
  push(`${callee.name}(`);
  genNodeList(args, context);
  push(`)`);
}
function genStringLiteral(node, context) {
  const { push, indent, deIndent } = context;
  push(`'${node.value}'`);
}
function genArrayExpression(node, context) {
  const { push, indent, deIndent } = context;
  push("[");
  genNodeList(node.elements, context);
  push("]");
}
function genThisExpression(node, context) {
  const { push, indent, deIndent } = context;
  push(`this.${node.value}`);
}

// ================================================================================
// 测试
// ================================================================================
const ast = parse(template);
console.log(ast);
// {
//   type: "Root",
//   children: [
//     {
//       type: "Element",
//       tag: "div",
//       props: [{ type: "Attribute", name: "class", value: "home" }],
//       children: [
//         { type: "Text", content: "Hello " },
//         { type: "Interpolation", content: "title" },
//       ],
//     },
//   ],
// }

transform(ast);
const jsAst = ast.jsNode;
console.log(jsAst);
// {
//   type: "FunctionDecl",
//   id: { type: "Identifier", name: "render" },
//   params: [],
//   body: [
//     {
//       type: "ReturnStatement",
//       return: {
//         type: "CallExpression",
//         callee: { type: "Identifier", name: "h" },
//         arguments: [
//           { type: "StringLiteral", value: "div" },
//           {
//             type: "ArrayExpression",
//             elements: [
//               { type: "StringLiteral", value: "Hello " },
//               { type: "ThisExpression", value: "title" },
//             ],
//           },
//         ],
//       },
//     },
//   ],
// };

const code = generate(jsAst);
console.log(code);
// function render() {
//   return h("div", ["Hello ", this.title]);
// }
