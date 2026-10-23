/* This is a script to create a new post markdown file with front-matter */

import fs from "fs"
import path from "path"
import { parseArgs } from "node:util"
import { normalizeLanguageTag } from "../src/utils/language-utils.ts"

function getDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const usage = "Usage: pnpm new-post <filename> [--lang zh-CN|en|other-language-tag]"
let args
let language

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { lang: { type: "string", default: "zh-CN" } },
  })
  args = positionals
  language = normalizeLanguageTag(values.lang)
} catch (error) {
  console.error(`Error: ${error.message}\n${usage}`)
  process.exit(1)
}

if (args.length !== 1) {
  console.error(`Error: Provide exactly one filename\n${usage}`)
  process.exit(1) // Terminate the script and return error code 1
}

let fileName = args[0]

// Add .md extension if not present
const fileExtensionRegex = /\.(md|mdx)$/i
if (!fileExtensionRegex.test(fileName)) {
  fileName += ".md"
}

const targetDir = "./src/content/posts/"
const fullPath = path.join(targetDir, fileName)

if (fs.existsSync(fullPath)) {
  console.error(`Error：File ${fullPath} already exists `)
  process.exit(1)
}

const content = `---
title: ${args[0]}
published: ${getDate()}
description: ''
image: ''
tags: []
category: ''
draft: false 
lang: '${language}'
---
`

fs.writeFileSync(path.join(targetDir, fileName), content)

console.log(`Post ${fullPath} created`)
