### 模板编译分为那几个步骤？

_解析模板生成模板 AST_

```js
let str = "<p>Vue</p>";
```

如以上模板利用 _有限状态机_ 先解析语法生成 `tokens` 集合。

```js
let tokens = [
  { type: "tag", name: "p" },
  { type: "text", content: "Vue" },
  { type: "tagEnd", name: "p" },
];
```

根据 `tokens` 维护一个栈用于匹配标签的开头和结尾生成模板的 `AST`。

```json
{
  "type": "Root",
  "children": [
    {
      "type": "Element",
      "tag": "p",
      "children": [{ "type": "Text", "content": "Vue" }]
    }
  ]
}
```

_转换模板 AST 为 JSAST_

这一步是为了转化为目标语言的 `AST` 节点便于后续的优化和生成。

```json
{
  "type": "Root",
  "children": [
    {
      "type": "FunctionDecl",
      "id": { "type": "Identifier", "name": "render" },
      "params": [],
      "body": [
        {
          "type": "ReturnStatement",
          "return": {
            "type": "CallExpression",
            "callee": { "type": "Identifier", "name": "h" },
            "arguments": [
              { "type": "StringLiteral", "value": "p" },
              { "type": "StringLiteral", "value": "Vue" }
            ]
          }
        }
      ]
    }
  ]
}
```

_根据 JSAST 生成渲染函数_

最后根据 `JSAST` 拼接字符串生成目标语言。

```js
function render() {
  return h("p", "Vue");
}
```
