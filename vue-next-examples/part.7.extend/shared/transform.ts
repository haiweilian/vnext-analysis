import { makeMap } from "../../../vue-next-3.2.0/packages/shared/src/makeMap";

/**
 * 转换成 key: true
 */
const make1 = makeMap("a,b,c");

console.log(make1("a"));
console.log(make1("C"));

const make2 = makeMap("a,b,c", true);

console.log(make2("a"));
console.log(make2("C"));

/**
 * 函数结果缓存
 */
const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null);
  return ((str: string) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  }) as any;
};

function join(...arg) {
  console.log(arg);
  return [...arg].join(",");
}

const cache1 = cacheStringFunction(join);
// 只输出一次
cache1(1, 2);
cache1(1, 2);
cache1(1, 2);
cache1(1, 2);
