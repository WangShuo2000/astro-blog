import { visit } from 'unist-util-visit'

export function remarkMathMetadata() {
  return (tree, { data }) => {
    let hasMath = false
    visit(tree, ['math', 'inlineMath', 'code'], node => {
      if (node.type !== 'code' || node.lang === 'math') hasMath = true
    })
    data.astro.frontmatter.hasMath = hasMath
  }
}
