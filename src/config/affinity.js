/**
 * 好感度系统
 * ---------------------------------------------------------------
 * 存储 key: lt_aff
 *   {
 *     v: 12,                  // 好感度数值
 *     dev: 0,                 // 开发者模式（仅开发者版可开）
 *     day: '2026-10-31',      // 最近一次登录日期（用于每日签到）
 *     streak: 3,              // 连续登录天数
 *     days: 9,                // 累计登录天数
 *     slotDay: '2026-10-31',  // 时段互动记录属于哪一天
 *     slots: ['dawn','noon'], // 今天已经互动过的时段
 *     best: { storyId: 'good' },  // 每段剧情的最好结局（判断「首次」）
 *     last: 3                 // 最近一次变化量（正负），主页/聊天页拿来显示
 *   }
 *
 * v2.9.1 重写持久化层 —— 修「点一下数字变了、回头又归零」：
 *   旧写法每次加减都 `storage.get` 一次再 `storage.set`，有两个致命问题：
 *     ① 读回来的可能是上一次写入之前的旧值（异步竞态）→ 用旧值覆盖新值
 *     ② 读不到就当空存档 → 直接归零
 *   现在改成：
 *     · 进程内只保留**一份**状态（_st），第一次读出来之后就以它为准
 *     · 所有加减都同步作用在这份状态上 → UI 立刻更新（不等写盘）
 *     · 写盘串行排队，写的过程中又有新变化就再补写一次，永远不会丢
 *     · 读失败/空存档只在「真的没读过」时才当成初始值，不会把已有进度冲掉
 *
 * 加减规则：
 *   每天第一次打开           +3（连续 3 天再 +1，连续 7 天再 +2）
 *   断签后回来               +2（不扣分，宠物不该惩罚主人）
 *   每个时段第一次点她        +1（每天最多 +4）
 *   剧情首次通关             按选项累计分数换算（-4 ~ +6）
 *   剧情重玩但刷新最好结局    给一半
 * ---------------------------------------------------------------
 */
import { getJSON, setJSON } from './store.js'
import { DEV_MODE } from './build-mode.js'

export const AFF_KEY = 'lt_aff'

/** 等级表：need = 达到该等级所需好感度 */
export const LEVELS = [
  { lv: 1, name: '初识', need: 0,   hint: '刚认识，请多指教' },
  { lv: 2, name: '熟悉', need: 16,  hint: '开始记住你的作息了' },
  { lv: 3, name: '亲近', need: 40,  hint: '有些心事，只想说给你听' },
  { lv: 4, name: '交心', need: 75,  hint: '你一出现，心情就不一样了' },
  { lv: 5, name: '默契', need: 120, hint: '不用说话，也听得见彼此' },
  { lv: 6, name: '唯一', need: 180, hint: '只想待在你身边，哪儿也不去' }
]

export const MAX_AFF = 999
export const SLOT_CAP = 4          // 每天最多靠「时段互动」拿几分
export const DEV_MODE_ENABLED = DEV_MODE === 1   // 这一版是不是「开发者版」
export const DEV_DEFAULT = DEV_MODE              // 开发者版默认开、正式版恒关

function emptyState() {
  return {
    v: 0, dev: DEV_DEFAULT, day: '', streak: 0, days: 0,
    slotDay: '', slots: [], best: {}, last: 0
  }
}

/** 把读出来的对象补齐成合法状态（缺字段不会崩） */
function normalize(s) {
  const st = (s && typeof s === 'object') ? s : emptyState()
  if (typeof st.v !== 'number' || isNaN(st.v)) st.v = 0
  if (st.v < 0) st.v = 0
  if (st.v > MAX_AFF) st.v = MAX_AFF
  if (typeof st.dev !== 'number') st.dev = DEV_DEFAULT
  if (typeof st.day !== 'string') st.day = ''
  if (typeof st.streak !== 'number') st.streak = 0
  if (typeof st.days !== 'number') st.days = 0
  if (typeof st.slotDay !== 'string') st.slotDay = ''
  if (!st.slots || typeof st.slots.length !== 'number') st.slots = []
  if (!st.best || typeof st.best !== 'object') st.best = {}
  if (typeof st.last !== 'number') st.last = 0
  return st
}

export function pad2(n) { return n < 10 ? '0' + n : '' + n }

export function dayKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

/** 两个日期相差几天（按自然日算） */
export function dayDiff(a, b) {
  if (!a || !b) return 99
  const pa = a.split('-')
  const pb = b.split('-')
  const ta = new Date(+pa[0], +pa[1] - 1, +pa[2]).getTime()
  const tb = new Date(+pb[0], +pb[1] - 1, +pb[2]).getTime()
  return Math.round(Math.abs(tb - ta) / 86400000)
}

/** 由好感度数值算等级信息（含下一级进度） */
export function levelOf(v) {
  let cur = LEVELS[0]
  let next = null
  for (let i = 0; i < LEVELS.length; i++) {
    if (v >= LEVELS[i].need) cur = LEVELS[i]
    else { next = LEVELS[i]; break }
  }
  const base = cur.need
  const top = next ? next.need : cur.need + 60
  let pct = 100
  if (next) pct = Math.max(0, Math.min(100, Math.round((v - base) * 100 / (top - base))))
  return {
    lv: cur.lv, name: cur.name, need: cur.need, hint: cur.hint,
    nextNeed: next ? next.need : top, pct: pct, maxed: !next
  }
}

/* ---------------- 进程内单例 + 串行写盘 ---------------- */

let _st = null              // 唯一权威状态
let _ready = false          // 是否已经从存储读过一次
let _busy = false           // 首次读取中
const _waiters = []         // 首次读取还没回来时排队的读者

let _writing = false        // 有写操作在飞
let _again = false          // 写的过程中又变了，写完要再写一次
const _wcbs = []            // 等写盘结束的回调

function notifyWaiters() {
  const q = _waiters.splice(0, _waiters.length)
  for (let i = 0; i < q.length; i++) {
    try { q[i](_st) } catch (e) {}
  }
}

function flushWrites() {
  if (_writing) { _again = true; return }
  _writing = true
  _again = false
  const snapshot = _st
  let done = false
  const finish = function () {
    if (done) return
    done = true
    _writing = false
    if (_again) { flushWrites(); return }        // 期间又变了 → 再写一次最新值
    const cbs = _wcbs.splice(0, _wcbs.length)
    for (let i = 0; i < cbs.length; i++) {
      try { cbs[i](_st) } catch (e) {}
    }
  }
  setJSON(AFF_KEY, snapshot, finish)
}

/**
 * 读状态。第一次会真的读存储，之后直接给内存里那份 ——
 * 不会再出现「读到旧值把新加的分数冲掉」。
 */
export function loadAff(cb) {
  if (_ready && _st) { cb(_st); return }
  _waiters.push(cb)
  if (_busy) return
  _busy = true
  getJSON(AFF_KEY, function (o) {
    _st = normalize(o)
    _ready = true
    _busy = false
    notifyWaiters()
  })
}

/**
 * 落盘。同步把内存状态换掉，然后排队写。
 * cb 在「这一批写结束」时调一次（成功失败都调）。
 */
export function saveAff(st, cb) {
  if (st && typeof st === 'object') {
    _st = normalize(st)
    _ready = true
  }
  if (!_ready || !_st) { _st = emptyState(); _ready = true }
  if (cb) _wcbs.push(cb)
  flushWrites()
}

/* ---------------- 开发者模式 ---------------- */

export function isDev(st) {
  // 正式版（DEV_MODE=0）：无论存档里写的是什么，都不算开发者模式
  if (!DEV_MODE_ENABLED) return false
  if (!st) return true
  return typeof st.dev === 'number' ? st.dev === 1 : true
}

/** 实际生效的好感度：开发者模式下恒为满值（所有剧情门槛自动通过） */
export function effAff(st) {
  if (!st) return 0
  if (isDev(st)) return MAX_AFF
  return st.v || 0
}

/** 开关开发者模式（真实数值 v 不受影响，关掉就回到真实进度） */
export function setDev(on, cb) {
  loadAff(function (st) {
    st.dev = on ? 1 : 0
    saveAff(st, function () { if (cb) cb(st) })
  })
}

/**
 * 每日登录结算。
 * cb({ st, gain, streak, comeback, first, levelUp, level })
 * —— UI 立刻更新，写盘在后台进行。
 */
export function dailyLogin(cb) {
  loadAff(function (st) {
    const today = dayKey(new Date())
    if (st.day === today) {
      st.last = 0
      cb({
        st: st, gain: 0, streak: st.streak || 1, comeback: false, first: false,
        levelUp: null, level: levelOf(st.v)
      })
      return
    }
    const before = levelOf(st.v)
    const gap = dayDiff(st.day, today)
    const first = !st.day
    let gain = 0
    let comeback = false
    if (first) {
      st.streak = 1
      gain = 3
    } else if (gap <= 1) {
      st.streak = (st.streak || 0) + 1
      gain = 3 + (st.streak >= 7 ? 2 : (st.streak >= 3 ? 1 : 0))
    } else {
      st.streak = 1
      gain = 2
      comeback = gap >= 3
    }
    st.days = (st.days || 0) + 1
    st.day = today
    st.v = Math.min(MAX_AFF, st.v + gain)
    st.last = gain
    const after = levelOf(st.v)
    const levelUp = after.lv > before.lv ? after : null
    saveAff(st)                                   // 后台落盘，不等它
    cb({
      st: st, gain: gain, streak: st.streak, comeback: comeback, first: first,
      levelUp: levelUp, level: after
    })
  })
}

/**
 * 时段首次互动 +1（每天上限 SLOT_CAP）。
 * cb({ st, gain, level, levelUp })
 */
export function touchSlot(slot, cb) {
  loadAff(function (st) {
    const today = dayKey(new Date())
    if (st.slotDay !== today) {
      st.slotDay = today
      st.slots = []
    }
    if (st.slots.indexOf(slot) >= 0 || st.slots.length >= SLOT_CAP) {
      cb({ st: st, gain: 0, level: levelOf(st.v), levelUp: null })
      return
    }
    st.slots.push(slot)
    const before = levelOf(st.v)
    st.v = Math.min(MAX_AFF, st.v + 1)
    st.last = 1
    const after = levelOf(st.v)
    saveAff(st)
    cb({
      st: st, gain: 1, level: after,
      levelUp: after.lv > before.lv ? after : null
    })
  })
}

/** 按剧情累计分数换算好感度增量 */
export function storyDelta(score) {
  if (score >= 4) return 6
  if (score >= 2) return 5
  if (score >= 1) return 3
  if (score === 0) return 1
  if (score === -1) return -2
  return -4
}

const RANK = { bad: 1, normal: 2, good: 3 }

/**
 * 剧情结算好感度。
 *   首次通关 → 按分数全给；重玩只有刷新了最好结局才给一半。
 * cb({ st, delta, first, level, levelUp })
 */
export function storyReward(storyId, grade, score, cb) {
  loadAff(function (st) {
    const prev = st.best[storyId] || ''
    const first = !prev
    const better = !prev || (RANK[grade] || 0) > (RANK[prev] || 0)
    let delta = 0
    if (first) delta = storyDelta(score)
    else if (better) delta = Math.max(1, Math.round(storyDelta(score) / 2))
    if (better) st.best[storyId] = grade

    const before = levelOf(st.v)
    if (delta) {
      st.v = Math.max(0, Math.min(MAX_AFF, st.v + delta))
      st.last = delta
    }
    const after = levelOf(st.v)
    saveAff(st)
    cb({
      st: st, delta: delta, first: first, level: after,
      levelUp: after.lv > before.lv ? after : null
    })
  })
}

/** 已解锁的剧情（好感度够不够） */
export function unlocked(story, aff) {
  if (!story.minAff) return true
  return aff >= story.minAff
}

/** 重置（开发者版用）：清空进度但保留开发者开关 */
export function resetAff(cb) {
  loadAff(function (st) {
    st.v = 0
    st.streak = 0
    st.days = 0
    st.slotDay = ''
    st.slots = []
    st.best = {}
    st.day = ''
    st.last = 0
    saveAff(st, function () { if (cb) cb(st) })
  })
}
