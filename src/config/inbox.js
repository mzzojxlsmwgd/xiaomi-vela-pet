/**
 * 消息中心状态（存储 + 触发 + 排序）
 *
 * 存储结构（key: lt_inbox）：
 *   {
 *     day: '2026-11-20',                    // 最近一次判定的日期（跨天把 count 归零）
 *     count: 2,                             // 今天已经自动冒出的「普通剧情」条数
 *     items: {
 *       storyId: { unread: 1, order: 1750000000000, times: 3, best: 'good' }
 *     }
 *   }
 *
 * 排序：未读优先，其次已解锁优先，再按 order（最近触发/最近游玩）倒序 → 玩完自然回到顶部。
 *
 * 显示范围：
 *   · 正式版只显示「已经收到过」的对话 —— 没解锁的不占位置
 *   · 开发者版显示全量，方便逐段查看
 *
 * 触发规则：
 *   ① 每次登录判定一次：概率 = 1 / 当前可触发对话数
 *      「可触发」= 好感度够 + 从未冒出来过 + 时段/日期对得上
 *   ② 普通剧情每天最多 dailyCap 条（默认 3）；额度用完就只可能冒好感度剧情
 *   ③ 好感度剧情（minAff > 0）与终章彩蛋**不受每日上限**，
 *      而且好感度剧情不看时段 —— 关系里程碑随时都可能发生
 *   ④ 一条剧情只要冒出来过（有 order），就**永远不会再自动触发**，
 *      想再看只能去消息中心点开重玩
 *
 * 为什么不是「每天一条」：一天只给一条时，一个 5 段剧情的角色要 5 天才能看全，
 * 而每次打开只掷一次骰子又太容易连着几天空手。改成「1/n + 每天 3 条」之后，
 * 可触发的越多越难中，但一天最多能收 3 条，节奏反而更接近「有消息就收」。
 */
import { getJSON, setJSON } from './store.js'
import { STORY_META } from './story-meta.js'
import { eventsOf } from './dates.js'
import { CHARACTER } from './character.js'
import { emojiPath } from './emoji.js'
import { loadAff, dayKey, unlocked, effAff, isDev } from './affinity.js'

export const INBOX_KEY = 'lt_inbox'
export const OPEN_KEY = 'lt_open'          // 打开聊天页时传参用（storage 传参最稳）

/* ---------------- 终章 / 彩蛋（在 character.js 里配） ---------------- */
/**
 * 机制：好感度到 finale.minAff 时，先强制冒出「彩蛋」那段（eggId），
 * 彩蛋玩完才放出最终消息（finalId）。
 * 两个 id 留空 = 不启用，两段剧情按普通剧情处理。
 */
const FIN = CHARACTER.finale || {}
export const EGG_ID = FIN.eggId || ''
export const FINAL_ID = FIN.finalId || ''
export const EGG_AFF = typeof FIN.minAff === 'number' ? FIN.minAff : 180
/** 终章机制是否启用 */
const FIN_ON = !!(EGG_ID && FINAL_ID)

/** 普通剧情每天最多自动冒出几条（好感度剧情 / 彩蛋不占额度）。在 character.js 里可配。 */
export const DAILY_CAP = typeof CHARACTER.dailyCap === 'number' && CHARACTER.dailyCap > 0
  ? CHARACTER.dailyCap
  : 3

function emptyState() {
  return { day: '', count: 0, items: {} }
}

export function slotOf(d) {
  const h = d.getHours()
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 11) return 'morning'
  if (h >= 11 && h < 13) return 'noon'
  if (h >= 13 && h < 17) return 'afternoon'
  if (h >= 17 && h < 20) return 'evening'
  if (h >= 20 && h < 23) return 'night'
  return 'late'
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

/** 这条对话「已经冒出来过」了吗（有 order 就算收到过，不管玩没玩） */
function received(st, id) {
  const it = st.items[id]
  return !!(it && it.order)
}

/** 彩蛋通关了吗（times > 0）—— 最终消息的解锁条件 */
function eggDone(st) {
  if (!FIN_ON) return true
  const it = st.items[EGG_ID]
  return !!(it && it.times)
}

export function loadState(cb) {
  getJSON(INBOX_KEY, function (s) {
    const st = (s && typeof s === 'object') ? s : emptyState()
    if (!st.items || typeof st.items !== 'object') st.items = {}
    if (typeof st.day !== 'string') st.day = ''
    // 老存档没有 count 字段 → 当作 0（今天还没冒过普通剧情）
    if (typeof st.count !== 'number' || st.count < 0) st.count = 0
    cb(st)
  })
}

export function saveState(state, cb) {
  setJSON(INBOX_KEY, state, cb)
}

/** 这条剧情今天「对得上时间」吗（日期事件 / 时段） */
function timeOk(s, slot, ev) {
  if (s.dates && s.dates.length) {
    let hit = false
    for (let i = 0; i < s.dates.length; i++) {
      if (ev.indexOf(s.dates[i]) >= 0) { hit = true; break }
    }
    if (!hit) return false
  }
  if (s.slots && s.slots.length) return s.slots.indexOf(slot) >= 0
  return true
}

/**
 * `slots: []` 且没有 `dates` = 显式声明「永远不会自动触发」。
 * 终章彩蛋、以及那些只能靠 revealStory() 推出来的剧情，都该这么写。
 */
function neverAuto(s) {
  return !!(s.slots && !s.slots.length && !(s.dates && s.dates.length))
}

/**
 * 每次登录判定一次：概率 = 1 / 当前可触发对话数。
 * cb(state, triggeredStoryId|null)
 *
 * 彩蛋 > 好感度剧情 > 普通剧情，但都走同一个骰子；
 * 只有普通剧情占「每天 DAILY_CAP 条」的额度。
 */
export function maybeTrigger(cb) {
  loadState(function (st) {
    const d = new Date()
    const slot = slotOf(d)
    const today = dayKey(d)

    // 跨天 → 每日额度归零。脏了就要落盘，否则存储里一直挂着昨天的 count
    let dirty = false
    if (st.day !== today) {
      st.day = today
      st.count = 0
      dirty = true
    }

    loadAff(function (aff) {
      const v = effAff(aff)          // 开发者模式下 = 满值，所有剧情都可触发

      // ⓪ 终章彩蛋：只要还没冒过就优先给。
      //    它不占每日额度、不看时段 —— 这是「通关」奖励，不该排队等着。
      //    （finale 没配时 FIN_ON 为 false，整段跳过）
      if (FIN_ON && v >= EGG_AFF && !received(st, EGG_ID)) {
        st.items[EGG_ID] = { unread: 1, order: d.getTime(), times: 0, best: '' }
        saveState(st, function () { cb(st, EGG_ID) })
        return
      }

      const ev = eventsOf(d)
      const bond = []        // 好感度剧情 + 最终消息：不占每日额度、不看时段
      const normal = []      // 普通剧情：按时段/日期，占每日额度

      for (let i = 0; i < STORY_META.length; i++) {
        const s = STORY_META[i]
        if (FIN_ON && s.id === EGG_ID) continue          // 彩蛋只走上面的专用通道
        if (received(st, s.id)) continue                 // 冒出来过就不再自动触发
        if (!unlocked(s, v)) continue                    // 好感度不够
        if (neverAuto(s)) continue                       // 声明了不自动触发
        if (FIN_ON && s.id === FINAL_ID && !eggDone(st)) continue   // 最终消息要等彩蛋通关

        if (s.minAff > 0) {
          bond.push(s)
        } else if (timeOk(s, slot, ev)) {
          normal.push(s)
        }
      }

      // 今天没有可触发的了 → 只把跨天重置落盘
      const flush = function () {
        if (dirty) saveState(st, function () { cb(st, null) })
        else cb(st, null)
      }

      // 今天的普通额度用完了 → 只剩好感度剧情还能冒
      const pool = (st.count < DAILY_CAP) ? bond.concat(normal) : bond
      if (!pool.length) { flush(); return }

      // 概率 = 1 / 可触发对话数
      if (Math.random() >= 1 / pool.length) { flush(); return }

      const pick = pool[Math.floor(Math.random() * pool.length)]
      const old = st.items[pick.id] || {}
      st.items[pick.id] = {
        unread: 1,
        order: d.getTime(),
        times: old.times || 0,
        best: old.best || ''
      }
      // 只有普通剧情占每日额度
      if (normal.indexOf(pick) >= 0) st.count++
      saveState(st, function () { cb(st, pick.id) })
    })
  })
}

/**
 * 组装成消息列表（已排序）
 *
 * v2.9.2 起：**没解锁的对话不显示**（不再置灰占位）。
 *   · 正式版：只列「已经收到过」的对话（`items[id].order` 存在）。
 *     没触发过的、好感度不够的一律不出现 —— 消息中心里只有真正的消息。
 *   · 开发者版：保留全量 18 段（未触发的置灰但仍可点进去玩），
 *     否则「可查看所有剧情」这个功能就没了。
 *
 * 排序：未读 > 已解锁 > 最近触发/游玩（玩完自然回到顶部）
 * @param st        消息状态
 * @param affState  好感度状态对象（不是数字，内部会走 effAff）
 */
export function buildList(st, affState) {
  const v = effAff(affState)
  const dev = isDev(affState)
  const done = eggDone(st)
  const arr = []
  for (let i = 0; i < STORY_META.length; i++) {
    const s = STORY_META[i]
    const it = st.items[s.id] || {}
    const affOk = unlocked(s, v)
    // 正式版：没收到过的对话直接跳过（这就是「没解锁的不显示」）
    if (!dev && !it.order) continue
    // 最终消息要等彩蛋玩完才露出来（老存档里已经收到过的不受影响）
    if (FIN_ON && !dev && s.id === FINAL_ID && !done && !received(st, FINAL_ID)) continue
    arr.push({
      id: s.id,
      title: s.title,
      minAff: s.minAff || 0,
      icon: emojiPath(s.icon, 0),
      unread: it.unread ? 1 : 0,
      affLocked: affOk ? 0 : 1,
      locked: (affOk && it.order) ? 0 : 1,
      order: it.order || 0,
      times: it.times || 0,
      best: it.best || ''
    })
  }
  arr.sort(function (a, b) {
    if (a.unread !== b.unread) return b.unread - a.unread
    if (a.locked !== b.locked) return a.locked - b.locked
    if (a.order !== b.order) return b.order - a.order
    return 0
  })
  return arr
}

export function unreadCount(st) {
  let n = 0
  for (const k in st.items) {
    if (st.items[k] && st.items[k].unread) n++
  }
  return n
}

/** 标记已读（进入聊天时） */
export function markRead(id, cb) {
  loadState(function (st) {
    const it = st.items[id] || {}
    it.unread = 0
    if (!it.order) it.order = new Date().getTime()
    st.items[id] = it
    saveState(st, cb)
  })
}

/** 玩完一段：次数+1、记录最好结局、置顶、清红点 */
export function markDone(id, grade, cb) {
  loadState(function (st) {
    const it = st.items[id] || {}
    it.unread = 0
    it.times = (it.times || 0) + 1
    it.order = new Date().getTime()
    const rank = { bad: 1, normal: 2, good: 3 }
    if (!it.best || (rank[grade] || 0) > (rank[it.best] || 0)) it.best = grade
    st.items[id] = it
    // 彩蛋通关 → 顺手把最终消息放出来。
    // 放在这里而不是聊天页，是为了「只要彩蛋算玩完就一定解锁」，
    // 不管从哪个入口进来的。同一份状态里改完一次写盘。
    if (FIN_ON && id === EGG_ID && !received(st, FINAL_ID)) {
      st.items[FINAL_ID] = { unread: 1, order: it.order + 1, times: 0, best: '' }
    }
    saveState(st, cb)
  })
}

/**
 * 把一条还没出现过的对话推出来（置顶 + 红点）。
 * 现在只有一处用：彩蛋通关后放出最终消息 bond_always。
 * 已经有 order 的不会重复推（重玩彩蛋不该又冒一次红点）。
 */
export function revealStory(id, cb) {
  loadState(function (st) {
    if (received(st, id)) { if (cb) cb(st); return }
    st.items[id] = { unread: 1, order: new Date().getTime(), times: 0, best: '' }
    saveState(st, cb)
  })
}
