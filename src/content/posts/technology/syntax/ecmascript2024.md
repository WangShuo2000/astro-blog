---
title: ECMAScript2024部分语法
published: 2023-06-06
description: "An introduction to ECMAScript2024"
tags: ['ECMAScript']
category: Technology
draft: false
---

## 介绍

在 2023 目前已经结束的提案中，es 迎来一些新的语法和改动

## Array find from last

Proposal for .findLast() and .findLastIndex() methods on array and typed array.

`{Array, TypedArray}.prototype.findLast`

```javascript
const array = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]
array.findLast((number) => number.value % 2 === 1) // { value: 3 }
```

`{Array, TypedArray}.prototype.findLastIndex`

```javascript
const array = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]
array.findLastIndex((number) => number.value % 2 === 1) // 2
array.findLastIndex((number) => number.value === 5) // -1
```

可以代替原来
[...array].reserse().find() 和 [...array].reserse().findIndex()的写法

## Symbols as WeakMap keys

This proposal extends the WeakMap API to allow usage of unique Symbols as keys.
之前只能将对象作为 weakmap 的 key，现在可以将基本数据类型 symbol 作为 key

`Easy to create and share keys`

```javascript
const weakmap = new WeakMap()
const key = Symbol('symbol key')
weakmap.set(key, 'value')
```

`Record and Tuples`

This proposal aims to solve a problem space introduced by the Record & Tuple Proposal;
Records & Tuples can't contain objects, functions, or methods and will throw a TypeError when someone attempts to do it
之所以存在此限制，是因为 Record & Tuple 提案的主要目标之一是在默认情况下具有深度不变性保证和结构相等。

下面提到的用户空间解决方案提供了多种方法来规避此限制，并且 Record 和 Tuple 在没有对装箱对象的额外语言支持的情况下是可行且有用的。 该提案试图描述使用 Record 和 Tuple 来补充这些用户空间解决方案的使用的解决方案，但并不是在该语言中登陆 Record 和 Tuple 的先决条件。
接受 Symbol 值作为 WeakMap 键将允许 JavaScript 库实现它们自己的 RefCollection 之类的东西，这些东西可以重用（避免在所有地方传递映射，使用单个全局映射，并且只传递 Records 和 Tuples） 同时不会随着时间的推移泄漏内存。

```javascript
const server = #{
  port: 8080,
  handler: function (req) {}, // TypeError!
}
```

提案中给出的示例

```javascript
class RefBookkeeper {
  #references = new WeakMap()
  ref(obj) {
    // (Simplified; we may want to return an existing symbol if it's already there)
    const sym = Symbol()
    this.#references.set(sym, obj)
    return sym
  }
  deref(sym) {
    return this.#references.get(sym)
  }
}
globalThis.refs = new RefBookkeeper()

// Usage
const server = #{
  port: 8080,
  handler: refs.ref(function handler(req) {}),
}
refs.deref(server.handler)({})
```

## Change Array by copy

之前的 es 语法中有些会改变数组本身，但当你不想改变数组本身的时候还需要去拷贝一份再进行
所以该提案在 Array.prototype 和 TypedArray.prototype 上提供额外的方法，通过返回数组的新副本和更改来启用数组的更改。

```javascript
Array.prototype.toReversed() -> Array
Array.prototype.toSorted(compareFn) -> Array
Array.prototype.toSpliced(start, deleteCount, ...items) -> Array
Array.prototype.with(index, value) -> Array
```

toReversed, toSorted, with 同样加到了类数组上:

```javascript
TypedArray.prototype.toReversed() -> TypedArray
TypedArray.prototype.toSorted(compareFn) -> TypedArray
TypedArray.prototype.with(index, value) -> TypedArray
```

在类数组的子类上也可以使用

```javascript
Int8Array
Uint8Array
Uint8ClampedArray
Int16Array
Uint16Array
Int32Array
Uint32Array
Float32Array
Float64Array
BigInt64Array
BigUint64Array
```

示例：

```javascript
const array = [2, 1, 3, 4]

array.toReversed() //[4,3,1,2]
array //[2,1,3,4]

array.toSorted() //[1,2,3,4]
array //[2,1,3,4]

array.toSpliced(0, 1) //[1,3,4]
array //[2,1,3,4]

array.with(1, 5) //[2,5,3,4]
array //[2,1,3,4]
```

```javaScript
const outOfOrder = new Uint8Array([3, 1, 2]);
outOfOrder.toSorted(); // Uint8Array [1, 2, 3]
outOfOrder; // Uint8Array [3, 1, 2]
```
