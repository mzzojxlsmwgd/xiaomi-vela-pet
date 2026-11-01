/**
 * 生成 src/config/story-meta.js
 *
 * stories.js 是最大的一份数据，而 index / inbox / chat 三个页面都会引用它。
 * 但 index 和 inbox 只需要「列表元信息」：
 *   id / title / icon / slots / dates / minAff / order
 * 完整的分支树（steps / endings）只有 chat 页要。
 *
 * 所以这里把元信息抽成独立文件，inbox.js 改用它 →
 * index.js 和 inbox.js 都不再打包完整剧情树，省下的体积留给表情包。
 *
 * ⚠️ 改完 stories.js 必须重跑：node tools/gen_story_meta.mjs
 */
import { writeFileSync, copyFileSync, unlinkSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'src', 'config', 'story-meta.js')

// 拷成 .mjs 再 import：项目里的 .js 是 ESM，但 package.json 没声明 type，
// 直接 import 会触发 Node 的模块类型警告。拷一份临时文件最省事。
const TMP = join(ROOT, 'tools', '_stories_tmp.mjs')
copyFileSync(join(ROOT, 'src', 'config', 'stories.js'), TMP)
const { STORIES } = await import(pathToFileURL(TMP).href)
unlinkSync(TMP)

const FIELDS = ['id', 'title', 'icon', 'slots', 'dates', 'minAff', 'order']

function lit(v) {
  if (v === undefined || v === null) return null
  if (Array.isArray(v)) return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']'
  if (typeof v === 'number') return String(v)
  return JSON.stringify(v)
}

const rows = STORIES.map(s => {
  const parts = []
  for (const f of FIELDS) {
    const v = lit(s[f])
    if (v !== null) parts.push(f + ': ' + v)
  }
  return '  { ' + parts.join(', ') + ' }'
})

const head = `/**
 * 剧情元信息（自动生成，勿手改）。
 * 由 tools/gen_story_meta.mjs 从 stories.js 抽取 —— 改完 stories.js 记得重跑。
 *
 * 只保留消息列表 / 触发判定需要的字段；完整分支树在 stories.js（仅 chat 页引用）。
 */
export const STORY_META = [
`

const maxTitle = STORIES.reduce((m, s) => Math.max(m, s.title.length), 0)

const tail = `]

/** 最长标题的字数（消息列表按它决定标题字号，避免末尾被裁） */
export const MAX_TITLE_LEN = ${maxTitle}

/** 按 id 找元信息 */
export function metaOf(id) {
  for (let i = 0; i < STORY_META.length; i++) {
    if (STORY_META[i].id === id) return STORY_META[i]
  }
  return null
}
`

writeFileSync(OUT, head + rows.join(',\n') + '\n' + tail, 'utf8')

const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1)
console.log('写出 ' + OUT + '：' + STORIES.length + ' 段剧情，'
  + kb(head + rows.join(',\n') + tail) + ' KB（stories.js 原文另算）')
