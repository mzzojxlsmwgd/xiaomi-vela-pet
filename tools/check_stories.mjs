// 剧情图静态校验：断链 / 死循环 / 结局可达 / 分数区间
// 用法：node tools/check_stories.mjs
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const root = path.resolve(process.cwd())
const src = path.join(root, 'src', 'config', 'stories.js')
const tmp = path.join(root, 'tools', '_stories_tmp.mjs')
fs.copyFileSync(src, tmp)
const { STORIES } = await import(pathToFileURL(tmp).href)
fs.unlinkSync(tmp)

const dlgTmp = path.join(root, 'tools', '_dlg_tmp.mjs')
fs.copyFileSync(path.join(root, 'src', 'config', 'dialogue.js'), dlgTmp)
const { DATE_LINES } = await import(pathToFileURL(dlgTmp).href)
fs.unlinkSync(dlgTmp)
const EVENTS = new Set(Object.keys(DATE_LINES))

// 终章 / 彩蛋那两段由 character.js 的 finale 单独触发，不参与时段/日期判定
const charTmp = path.join(root, 'tools', '_char_tmp.mjs')
fs.copyFileSync(path.join(root, 'src', 'config', 'character.js'), charTmp)
const { CHARACTER } = await import(pathToFileURL(charTmp).href)
fs.unlinkSync(charTmp)
const FIN = CHARACTER.finale || {}
const FIN_IDS = [FIN.eggId, FIN.finalId].filter(Boolean)

let bad = 0
const fail = (m) => { console.log('  !! ' + m); bad++ }

for (const st of STORIES) {
  const ids = Object.keys(st.steps)
  const SLOTS = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night', 'late']
  let when = ''
  if (st.dates) {
    when = '日期 ' + st.dates.join('/')
    if (st.slots && st.slots.length) when += ' + 时段 ' + st.slots.join('/')
  } else {
    when = '时段 ' + (st.slots || []).join('/')
  }
  console.log(`\n[${st.id}] ${st.title}  步骤 ${ids.length}  ${when}`)
  if (st.dates) {
    for (const d of st.dates) if (!EVENTS.has(d)) fail(`dates 里的 ${d} 不是已知日期事件`)
  }
  const isFin = FIN_IDS.indexOf(st.id) >= 0
  if (!isFin && !st.dates && (!st.slots || !st.slots.length)) {
    fail('既没有 slots 也没有 dates，永远不会被触发')
  }
  if (st.slots) {
    for (const s2 of st.slots) if (SLOTS.indexOf(s2) < 0) fail(`slots 里的 ${s2} 不是合法时段`)
  }
  if (!st.steps[st.start]) fail('start 不存在: ' + st.start)
  if (!st.endings || !st.endings.good || !st.endings.normal || !st.endings.bad) fail('缺少 good/normal/bad 结局')

  // 链接检查
  for (const id of ids) {
    const s = st.steps[id]
    if (!s.say || !s.say.length) fail(`${id} 没有台词`)
    if (s.next && !st.steps[s.next]) fail(`${id}.next 指向不存在的 ${s.next}`)
    if (s.choices) {
      if (s.choices.length < 2) fail(`${id} 选项少于 2 个`)
      for (const c of s.choices) {
        if (!st.steps[c.next]) fail(`${id} 选项「${c.text}」指向不存在的 ${c.next}`)
      }
    }
    if (!s.next && !s.choices && !s.finish) fail(`${id} 是死路（无 next/choices/finish）`)
    if (s.finish && (s.next || s.choices)) fail(`${id} 同时有 finish 和 next/choices`)
  }

  // DFS 穷举：检测环、收集结局分数
  const scores = []
  let loops = 0
  const seen = new Set()
  const walk = (id, score, trail) => {
    if (trail.length > 60) { loops++; return }
    const s = st.steps[id]
    if (!s) return
    if (s.finish) { scores.push(score); return }
    if (s.choices) {
      for (const c of s.choices) walk(c.next, score + (c.score || 0), trail.concat(id))
    } else if (s.next) {
      const key = id + '>' + s.next
      if (trail.includes(id)) { loops++; return }   // 回到已访问节点 = 环
      walk(s.next, score, trail.concat(id))
    }
  }
  walk(st.start, 0, [])
  if (!scores.length) fail('从 start 走不到任何 finish')
  if (loops) fail(`存在环/超长路径 ${loops} 处`)

  const uniq = [...new Set(scores)].sort((a, b) => a - b)
  const max = Math.max(...scores), min = Math.min(...scores)
  console.log(`  路径结局分数: ${uniq.join(', ')}  (min ${min} / max ${max})`)
  // 这两条只提示不报错：只有一个选择点的短剧情本来就够不到 2 分，
  // 强行凑分反而别扭。想要三结局都可达，加第二个选择点即可。
  if (max < 2) console.log('  ~~ 提示：最高分 ' + max + ' < 2，good 结局拿不到（多给选项加分就好）')
  if (min > -1) console.log('  ~~ 提示：最低分 ' + min + ' > -1，bad 结局拿不到（给一个 -1 的选项就好）')

  // 可达性：从 start 能走到的步骤
  const reach = new Set()
  const stack = [st.start]
  while (stack.length) {
    const id = stack.pop()
    if (reach.has(id) || !st.steps[id]) continue
    reach.add(id)
    const s = st.steps[id]
    if (s.next) stack.push(s.next)
    if (s.choices) s.choices.forEach(c => stack.push(c.next))
  }
  const dead = ids.filter(i => !reach.has(i))
  if (dead.length) fail('不可达步骤: ' + dead.join(','))
}

console.log(bad ? `\n共 ${bad} 个问题` : '\n全部剧情校验通过')
process.exit(bad ? 1 : 0)
