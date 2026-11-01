/**
 * 逻辑冒烟测试（不需要手表、不需要编译）
 *
 *     node tools/smoke_test.mjs
 *
 * 它做的事：
 *   1) 自己在 node_modules 里塞一个 @system.storage 的内存桩（跑完自动删）
 *   2) 把 config/ 下的模块真跑一遍，检查：
 *        · 配置表之间的 key 是否对得上（时段 / 饭点 / 等级 / 表情 / 日期）
 *        · 剧情引用的表情名是否都存在
 *        · 消息触发与终章机制是否符合预期
 *        · 好感度等级换算
 *        · emojiPath 的帧数绕回
 *
 * 改完 config/ 里的任何东西，跑一遍这个能挡掉大部分低级错误。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const STUB_DIR = path.join(ROOT, 'node_modules', '@system', 'storage')

/* ---------------- ① 内存 storage 桩 ---------------- */
/*
 * `@system.storage` 是 Vela 的注入模块，Node 里没有，而且 `@system.xxx`
 * 不是合法的包名（作用域包必须是 @scope/name），所以不能用 node_modules 伪造。
 * 这里用 Node 的 loader hook 把它重定向到一个内存实现。
 */
const MEM = new Map()
let RETURN_SHAPE = 'bare'          // 'bare' 返回裸字符串 / 'wrapped' 返回 {data}

const TMP = path.join(ROOT, 'tools', '.tmp')

function installStub() {
  fs.mkdirSync(TMP, { recursive: true })

  fs.writeFileSync(path.join(TMP, 'storage.mjs'), `
const MEM = globalThis.__VELA_MEM__
export default {
  get(opt) {
    const v = MEM.get(opt.key)
    if (v === undefined) { opt.fail && opt.fail({ data: '' }); return }
    opt.success && opt.success(globalThis.__VELA_SHAPE__ === 'wrapped' ? { data: v } : v)
  },
  set(opt) { MEM.set(opt.key, '' + opt.value); opt.success && opt.success() },
  delete(opt) { MEM.delete(opt.key); opt.success && opt.success() },
  clear(opt) { MEM.clear(); opt.success && opt.success() }
}
`, 'utf8')

  fs.writeFileSync(path.join(TMP, 'loader.mjs'), `
const STUB = new URL('./storage.mjs', import.meta.url).href
export async function resolve(specifier, context, next) {
  if (specifier === '@system.storage') return { url: STUB, shortCircuit: true }
  return next(specifier, context)
}
`, 'utf8')

  globalThis.__VELA_MEM__ = MEM
  globalThis.__VELA_SHAPE__ = RETURN_SHAPE
}

function removeStub() {
  fs.rmSync(TMP, { recursive: true, force: true })
}

installStub()
const { register } = await import('node:module')
register(pathToFileURL(path.join(TMP, 'loader.mjs')).href, import.meta.url)

/* ---------------- ② 断言工具 ---------------- */

let pass = 0
const fails = []
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fails.push(name); console.log('  ✗ ' + name + (extra ? '   → ' + extra : '')) }
}
function eq(name, a, b) { ok(name, a === b, '得到 ' + JSON.stringify(a) + '，期望 ' + JSON.stringify(b)) }

/* ---------------- ③ 加载模块 ---------------- */

const { valueOf, getJSON, setJSON } = await import('../src/config/store.js')
const { CHARACTER } = await import('../src/config/character.js')
const { EMOJI, EMOJI_HI, framesOf, emojiPath, EXT } = await import('../src/config/emoji.js')
const { STORIES } = await import('../src/config/stories.js')
const { STORY_META, MAX_TITLE_LEN } = await import('../src/config/story-meta.js')
const DLG = await import('../src/config/dialogue.js')
const { slotOf, maybeTrigger, markDone, markRead, buildList, loadState, unreadCount,
  EGG_ID, FINAL_ID, EGG_AFF } =
  await import('../src/config/inbox.js')
const { eventsOf } = await import('../src/config/dates.js')
const { LEVELS, levelOf, dayKey, resetAff } = await import('../src/config/affinity.js')

/* ---------------- ④ 配置一致性 ---------------- */

console.log('\n[1] 配置表 key 一致性')

const SLOTS = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night', 'late']
// slotOf 能返回的时段集合
const slotSet = new Set()
for (let h = 0; h < 24; h++) {
  const d = new Date(2026, 0, 1, h, 30)
  slotSet.add(slotOf(d))
}
eq('slotOf 覆盖 7 个时段', slotSet.size, 7)
ok('slotOf 的返回值都在 TIME_LINES 里',
  [...slotSet].every(s => Array.isArray(DLG.TIME_LINES[s]) && DLG.TIME_LINES[s].length),
  [...slotSet].filter(s => !DLG.TIME_LINES[s]).join(','))

ok('TIME_LINES 没有多余 key',
  Object.keys(DLG.TIME_LINES).every(k => SLOTS.indexOf(k) >= 0),
  Object.keys(DLG.TIME_LINES).filter(k => SLOTS.indexOf(k) < 0).join(','))

ok('MEAL_LINES 三个 key 齐全',
  ['breakfast', 'lunch', 'dinner'].every(k => Array.isArray(DLG.MEAL_LINES[k]) && DLG.MEAL_LINES[k].length))

ok('LOGIN_LINES 三个分支齐全',
  ['streak', 'comeback', 'again'].every(k => Array.isArray(DLG.LOGIN_LINES[k]) && DLG.LOGIN_LINES[k].length))

ok('LEVEL_UP_LINES 的 key 都是 2~6 的等级',
  Object.keys(DLG.LEVEL_UP_LINES).every(k => {
    const lv = +k
    return LEVELS.some(x => x.lv === lv) && lv >= 2
  }))

ok('BOND_LINES 的 key 都是合法等级',
  Object.keys(DLG.BOND_LINES).every(k => LEVELS.some(x => x.lv === +k)))

ok('EXPR_LINES 的 key 都在 EMOJI 里',
  Object.keys(DLG.EXPR_LINES).every(k => EMOJI.indexOf(k) >= 0),
  Object.keys(DLG.EXPR_LINES).filter(k => EMOJI.indexOf(k) < 0).join(','))

ok('EMOJI_HI 里的名字都存在',
  EMOJI_HI.every(e => EMOJI.indexOf(e) >= 0), EMOJI_HI.filter(e => EMOJI.indexOf(e) < 0).join(','))
ok('至少有一个 idle', EMOJI.indexOf('idle') >= 0)

ok('剧情 icon 都在 EMOJI 里',
  STORY_META.every(s => EMOJI.indexOf(s.icon) >= 0),
  STORY_META.filter(s => EMOJI.indexOf(s.icon) < 0).map(s => s.id + ':' + s.icon).join(','))

// 日期事件 → DATE_LINES
const evSet = new Set()
for (let m = 0; m < 12; m++) {
  const last = new Date(2026, m + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    for (const e of eventsOf(new Date(2026, m, d))) evSet.add(e)
  }
}
ok('eventsOf 能产生的日期事件都有台词',
  [...evSet].every(e => Array.isArray(DLG.DATE_LINES[e]) && DLG.DATE_LINES[e].length),
  [...evSet].filter(e => !DLG.DATE_LINES[e]).join(','))
ok('DATE_LINES 没有永远用不上的 key',
  Object.keys(DLG.DATE_LINES).every(k => evSet.has(k) || k === 'birthday'),
  Object.keys(DLG.DATE_LINES).filter(k => !evSet.has(k) && k !== 'birthday').join(','))

console.log('\n[2] 剧情索引与 stories.js 同步')
eq('story-meta 段数与 stories.js 一致', STORY_META.length, STORIES.length)
ok('story-meta 的 id 顺序与 stories.js 一致',
  STORY_META.every((s, i) => s.id === STORIES[i].id))
eq('MAX_TITLE_LEN 等于最长标题字数',
  MAX_TITLE_LEN, Math.max(...STORIES.map(s => s.title.length)))

console.log('\n[3] 表情路径')
eq('默认 1 帧', framesOf('happy'), 1)
eq('帧号绕回', emojiPath('happy', 3), '/common/emoji/happy_0.' + EXT)
eq('负帧号也绕回', emojiPath('happy', -1), '/common/emoji/happy_0.' + EXT)

console.log('\n[4] storage 载荷形态兼容')
eq('裸字符串', valueOf('abc'), 'abc')
eq('{data}', valueOf({ data: 'abc' }), 'abc')
eq('{value}', valueOf({ value: 'abc' }), 'abc')
eq('{result}', valueOf({ result: 'abc' }), 'abc')
eq('null', valueOf(null), '')
eq('数字', valueOf(123), '123')

// 真读一遍，两种形态都要能读到
MEM.set('lt_probe', JSON.stringify({ a: 1 }))
let got = null
await new Promise(r => getJSON('lt_probe', o => { got = o; r() }))
eq('裸字符串形态能解析出对象', got && got.a, 1)

console.log('\n[5] 好感度等级')
eq('0 → Lv1', levelOf(0).lv, 1)
eq('16 → Lv2', levelOf(16).lv, 2)
eq('179 → Lv5', levelOf(179).lv, 5)
eq('180 → Lv6 且满级', levelOf(180).lv, 6)
ok('Lv6 是 maxed', levelOf(180).maxed === true)
ok('等级 need 单调递增', LEVELS.every((x, i) => i === 0 || x.need > LEVELS[i - 1].need))

/* ---------------- ⑤ 消息触发 / 终章机制 ---------------- */

console.log('\n[6] 消息触发')

function setAff(v, dev) {
  MEM.set('lt_aff', JSON.stringify({
    v, dev: dev || 0, day: '', streak: 0, days: 0, slotDay: '', slots: [], best: {}, last: 0
  }))
}
function clearInbox() { MEM.delete('lt_inbox') }
const trigger = () => new Promise(r => maybeTrigger((st, id) => r(id)))
const listOf = () => new Promise(r => loadState(st =>
  loadAffState(a => r(buildList(st, a)))))
const loadAffState = (cb) => {
  // 直接用 storage 里的状态构造 affState（buildList 需要它）
  getJSON('lt_aff', o => cb(o || { v: 0, dev: 0 }))
}
const done = (id) => new Promise(r => markDone(id, 'good', r))

// ⚠️ affinity.js 是「进程内单例」，第一次 loadAff 之后就不再读存储。
//    所以这里必须**先**把满好感写进存储，测完再用 resetAff 降回来。
clearInbox(); setAff(EGG_AFF)
const t1 = await trigger()
eq('好感满时优先触发彩蛋', t1, EGG_ID)

// 彩蛋不占用「每天一条」的配额 —— 所以同一天还会再冒一条普通剧情
const t2 = await trigger()
ok('彩蛋不占用每日配额（同日还能收到普通剧情）',
  t2 && t2 !== EGG_ID && t2 !== FINAL_ID, '得到 ' + t2)
await new Promise(r => markRead(t2, r))

const t3 = await trigger()
eq('每日配额用完后不再触发', t3, null)

await done(EGG_ID)
const st = await new Promise(r => loadState(r))
ok('彩蛋玩完 → 最终消息被放出', !!(st.items[FINAL_ID] && st.items[FINAL_ID].order))
ok('最终消息带红点', st.items[FINAL_ID].unread === 1)
eq('未读只有最终消息那一条', unreadCount(st), 1)

const list = await listOf()
const ids = list.map(x => x.id)
ok('列表里最终消息排在最前（未读优先）', ids[0] === FINAL_ID, ids.join(','))
ok('列表里不出现没收到过的剧情',
  ids.every(id => st.items[id] && st.items[id].order), ids.join(','))

// 彩蛋已收过 → 再触发时不该再走专用通道
MEM.set('lt_inbox', JSON.stringify({
  day: '', items: { [EGG_ID]: { unread: 0, order: 1, times: 1, best: 'good' } }
}))
const t5 = await trigger()
ok('彩蛋收过之后不再走专用通道', t5 !== EGG_ID, '得到 ' + t5)

// 降回 0 好感，确认普通剧情照常触发
await new Promise(r => resetAff(r))
clearInbox()
const t4 = await trigger()
ok('好感 0 时触发普通剧情', t4 && t4 !== EGG_ID && t4 !== FINAL_ID, '得到 ' + t4)

/* ---------------- 收尾 ---------------- */

console.log('')
if (fails.length) {
  console.log('共 ' + (pass + fails.length) + ' 项，失败 ' + fails.length + ' 项：')
  fails.forEach(f => console.log('  · ' + f))
  removeStub()
  process.exit(1)
}
console.log('全部 ' + pass + ' 项通过')
removeStub()
