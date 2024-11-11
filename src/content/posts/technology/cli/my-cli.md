---
title: 创建自己的vue3开发脚手架
published: 2023-07-27
description: 'create my vue3 cli'
tags: ['Vue3', 'Cli', '封装组件']
category: Technology
draft: false
---

## 背景

聊聊为什么现在想自己实现一个脚手架，脚手架只是工具，最终的目的是生成一个能创建完整项目开箱即用的 vue3 项目，
我自己本身这一年多都是在做 b 端系统的开发，虽然可以有现成的 ui 组件库类似 antd 这种或者我们的自研组件库，但在实际开发的时候还是能够体会到
代码不够简洁和不利于维护，所以在我们内部有封装一些组件，能够使用传参和使用解构出的方法注册并使用组件，但有些地方不够灵活，
所以在此情况下，并调研了 vben 后，我想以我的开发视角和体验来解决一些后台开发的痛点和难点，以达到提效

## 命名

`fe-easy-cli`

起初想了几个名称，然后去 npm 官网查了一下全被注册了 😂，我就想着从我的立意去思考下，这是给前端开发者使用的脚手架，就以 fe 开头，
它的目的是能够简单使用和开发，就连接着-esay，最后以 cli 结尾

## 主要内容

介绍下利用脚手架生成的项目主要会生成什么内容以及提供给开发者哪些选项

`脚手架使用及选项`

在输入 fe-easy-cli -c 后输入项目名，选择 vue，选择 vue3-template-prittier，目前写了只写了一个了 tsx 的模版，后续会增加一个 ts 的选项供选择

`规范、配置文件`

在命令 fe-easy-cli -c 执行时会自动执行 git init 去创建一个.git 文件夹，这里是为了配合使用 husky，在提交代码的时候触发
pre-commit 钩子然后对于 lint-staged 的代码进行已有的 eslint 和 prettier 规则校验以决定是否能提交成功，以保证项目开发的一些
规范性

`ui库、样式`

ui 库我引入的是 ant-design-vue，使用的是最新版本 4.x，为了在写 css 样式能够更加方便引入了 unocss 以对应的某些好用的指令，至于为什么
舍弃了 tailwind 而是采用了 unocss，可以看看 Anthony Fu 的介绍

`页面布局`

目前先将页面分为了左边导航栏，右侧内容两个区域

`组件`

我计划封装一些基础组件例如：

<span className="font-bold">BaseTable</span>
<span className="font-bold">BaseModal</span>
<span className="font-bold">BaseForm</span>
<span className="font-bold">BaseButton</span>
<span className="font-bold">BaseSelect</span>

开发者能够通过组件和导出的 hooks 去便捷使用，以减少拥挤在 template 中的代码

`环境变量`

后续会增加.env.development .env.test .env.prodction 去区分开发，测试，线上环境；以及增加一些环境变量开放给开发者

## 结尾

目前已经开发一个初版已经能通过命令生成一个 vue-tsx 的项目，也封装了 BaseTable 和 BaseModal 的基础功能，等到功能较为完善的时候再发布到 npm。
因为这两天打算离职，然后后续会有时间去记录我的整个开发过程，下一篇文章将从头开始介绍-如何实现自己的脚手架
