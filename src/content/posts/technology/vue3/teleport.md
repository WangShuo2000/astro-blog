---
title: 探究Teleport
published: 2023-05-18
description: 'introduce Teleport in vue3'
tags: ['Vue3', 'Component']
category: Technology
draft: false
---

## 背景

当我们想在 vue 中开发一个能够指定位置渲染的组件例如 tooltip、modal 时可能首先想到的是去引 ui 库中的组件，
或者自己手写一个，但 vue3 中提供的内置组件 Teleport 能够帮我们轻松解决问题，下面就来介绍下它的用
法以及实现原理

## 正文

官网对于它的介绍是： `<Teleport>` 是一个内置组件，它可以将一个组件内部的一部分模板“传送”到该组件的 DOM 结构外层的位置去

### 用法及属性

```html
<Teleport to="body" :disabled="disabled">
  <div></div>
</Teleport>

//to: 传送的目标，dom对象/css选择器字符串 //disabled: 是否禁用
```

```typescript
const disabled = ref<boolean>(false)
```

用法还是挺简单的，然后来看下需要注意的地方

### Tip

1. `<Teleport>` 挂载时，传送的 to 目标必须已经存在于 DOM 中。
   如果目标元素也是由 Vue 渲染的，需要确保在挂载 `<Teleport>` 之前先挂载该元素

1. 可以搭配组件使用，只改变了渲染的 DOM 结构，它不会影响组件间的逻辑关系，
   `<Teleport>` 和内部组件始终保持父子关系，也就是说 props 和 provide 都可以正常使用

1. 多个 Teleport 会共享目标，多个 `<Teleport>` 组件可以将其内容挂载在同一个目标元素上，而顺序就是顺次追加

```html
<Teleport to=".modal">
  <div>A</div>
</Teleport>
<Teleport to=".modal">
  <div>B</div>
</Teleport>

结果:
<div class=".modal">
  <div>A</div>
  <div>B</div>
</div>
```

### 实现一个简单的 tooltip

```html
<div
  v-for="(item, index) in array"
  :key="index"
  @mousemove="handleMousemove($event, index)"
  @mouseleave="handleMouseleave"
></div>
<teleport to="body">
  <div
    class="max-w-60vw rounded-10px p-10px border-2px fixed border-indigo-300 bg-white"
    ref="toolTipRef"
    :style="{
            left: tooltipStyle.x,
            top: tooltipStyle.y,
            opacity: tooltipStyle.opacity,
        }"
  >
    <span>{{ tooltipStyle.content }}</span>
  </div>
</teleport>
```

实现的大概逻辑就是鼠标目标元素上划过时更改 teleport 内部元素的透明度，移除时将透明度改为 0

```typescript
<script lang="ts" setup>
    const tooltipStyle = reactive({
        x: '0px',
        y: '0px',
        content: '',
        opacity: 0,
    });
    const array = ref<string[]>(['test'])

    const handleMousemove = (e: MouseEvent, index: number) => {
        tooltipStyle.opacity = 1;
        tooltipStyle.x = e.x + 10 + 'px';
        tooltipStyle.y = e.y + 10 + 'px';
        tooltipStyle.content = array.value[index]
    };

    const handleMouseleave = () => {
        tooltipStyle.opacity = 0;
    };
</script>
```

看完用法，接着就到本文的重点了，让我们来探究下核心源码是怎么实现的

### 原理

首先我们可以考虑的问题是将 teleport 的渲染和正常 vnode 的渲染分离开，这样做的优点是：

1. 渲染函数中保持整洁
1. 当我们没有使用 Teleport 时，因为将这个渲染逻辑单独抽出来，所以可以利用 tree-shaking 将相关的代码删除
   所以 vue 的做法是针对 teleport 组件重新写了套渲染代码：

在 renderer 的 patch 函数中，如果遇到类型是 teleport 的，就使用自己的挂载方法，这里的 TeleportImpl 就是具体的实现对象

```typescript
else if (shapeFlag & ShapeFlags.TELEPORT) {
    ;(type as typeof TeleportImpl).process(
        n1 as TeleportVNode,
        n2 as TeleportVNode,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized,
        internals
    )
}

移动函数move
if (shapeFlag & ShapeFlags.TELEPORT) {
    ;(type as typeof TeleportImpl).move(vnode, container, anchor, internals)
    return
}
```

下面我们来看具体是怎么实现的(保留核心代码)

对应的位置在仓库的`Teleport.ts`文件中

```typescript
const TeleportImpl = {
  process(
    n1: TeleportVNode | null,
    n2: TeleportVNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    internals: RendererInternals
  ) {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment },
    } = internals

    const disabled = isTeleportDisabled(n2.props)
    let { shapeFlag, children, dynamicChildren } = n2

    //如果是首次挂载
    if (n1 == null) {
      // insert anchors in the main view
      const placeholder = (n2.el = createText(''))
      const mainAnchor = (n2.anchor = createText(''))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)
      //resolveTarget处理传入的to属性
      const target = (n2.target = resolveTarget(n2.props, querySelector))
      const targetAnchor = (n2.targetAnchor = createText(''))
      if (target) {
        insert(targetAnchor, target)
      }

      //自己的挂载方法
      const mount = (container: RendererElement, anchor: RendererNode) => {
        // Teleport *always* has Array children. This is enforced in both the
        // compiler and vnode children normalization.
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(children as VNodeArrayChildren, container, anchor, parentComponent)
        }
      }

      if (disabled) {
        mount(container, mainAnchor)
      } else if (target) {
        mount(target, targetAnchor)
      }
    } else {
      // 更新
      n2.el = n1.el
      const mainAnchor = (n2.anchor = n1.anchor)!
      const target = (n2.target = n1.target)!
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor)!
      const wasDisabled = isTeleportDisabled(n1.props)
      const currentContainer = wasDisabled ? container : target
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor

      if (dynamicChildren) {
        // fast path when the teleport happens to be a block root
        patchBlockChildren(n1.dynamicChildren!, dynamicChildren, currentContainer, parentComponent)
        // even in block tree mode we need to make sure all root-level nodes
        // in the teleport inherit previous DOM references so that they can
        // be moved in future patches.
        traverseStaticChildren(n1, n2, true)
      }

      if (disabled) {
        if (!wasDisabled) {
          // enabled -> disabled
          // move into main container
          moveTeleport(n2, container, mainAnchor, internals, TeleportMoveTypes.TOGGLE)
        }
      } else {
        // target changed
        if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          const nextTarget = (n2.target = resolveTarget(n2.props, querySelector))
          if (nextTarget) {
            moveTeleport(n2, nextTarget, null, internals, TeleportMoveTypes.TARGET_CHANGE)
          }
        } else if (wasDisabled) {
          // disabled -> enabled
          // move into teleport target
          moveTeleport(n2, target, targetAnchor, internals, TeleportMoveTypes.TOGGLE)
        }
      }
    }
  },
}
```

然后我们看 process 里的重要函数

`moveTarget`

```typescript
function moveTeleport(
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: RendererInternals,
  moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER
) {
  // move target anchor if this is a target change.
  if (moveType === TeleportMoveTypes.TARGET_CHANGE) {
    insert(vnode.targetAnchor!, container, parentAnchor)
  }
  const { el, anchor, shapeFlag, children, props } = vnode
  const isReorder = moveType === TeleportMoveTypes.REORDER
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(el!, container, parentAnchor)
  }
  // if this is a re-order and teleport is enabled (content is in target)
  // do not move children. So the opposite is: only move children if this
  // is not a reorder, or the teleport is disabled
  if (!isReorder || isTeleportDisabled(props)) {
    // Teleport has either Array children or no children.
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move((children as VNode[])[i], container, parentAnchor, MoveType.REORDER)
      }
    }
  }
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(anchor!, container, parentAnchor)
  }
}
```

`resolveTarget`

```typescript
const resolveTarget = <T = RendererElement>(
  props: TeleportProps | null,
  select: RendererOptions['querySelector']
): T | null => {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    if (!select) {
      return null
    } else {
      const target = select(targetSelector)
      return target as any
    }
  } else {
    return targetSelector as any
  }
}
```

看起来有些复杂，不过让我们理一下思路：上面我们提到了要实现自己的渲染方法，所以我们可以先写
基本的渲染函数，然后在内部需要区分是首次挂载还是组件更新，但如果是 teleport 的接收的参数更改了呢，
所以这时候就要去主动实现一个 move 函数将内容移动到新的节点下。好了，有了思路后我们来尝试写出来

1. **先来实现组件的挂载与更新**

```javascript
const Teleport = {
  __isTeleport: true,
  process(n1, n2, container, anchor, internals) {
    //通过internals拿到渲染器内部方法
    const { patch, patchChildren } = internals
    // 如果oldVnode不存在，就是全新挂载
    if (!n1) {
      //mount
      //获取挂载点
      const target =
        typeof n2.props.to === 'string' ? document.querySelector(n2.props.to) : n2.props.to

      //将newVnode挂载
      n2.children.forEach((child) => patch(null, child, target, anchor))
    } else {
      //更新
      patchChildren(n1, n2, container)
    }
  },
}
```

2. **上面我们提到了更新，但如果是 to 属性更改了呢，所以需要有个分支来处理**

```javascript
//如果新旧 to 参数不同，需要对内容移动
if (n2.props.to !== n1.props.to) {
  //获取新容器
  const newTarget =
    typeof n2.props.to === 'string' ? document.querySelector(n2.props.to) : n2.props.to
  //移动到新的容器上
  n2.children.forEach((child) => move(child, newTarget))
}
```

3. **传入 move 函数**

```javascript
else if (shapeFlag & ShapeFlags.TELEPORT) {
    type.process(n1, n2, container, anchor, {
        patch,
        patchChildren,
        move(vnode, container, anchor) {
            //这里只处理了组件或者普通元素
            const el = vnode.component ? vnode.component.subTree.el : vnode.el
            insert(el, container, anchor)
        }
    })
}
```

这里我们省略了处理 disabled 的 remove 函数，不是本文研究的重点，具体可以看源码的 Teleport 文件
