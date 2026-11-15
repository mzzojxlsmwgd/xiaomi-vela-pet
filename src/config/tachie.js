/**
 * 立绘（tachie）配置
 * ===============================================================
 * 主页有两种显示模式，用底栏的「切换」键互切：
 *
 *   表情包模式（默认）—— 现在的样子：中间一张方形表情图 + 下方一条对话气泡
 *   立绘模式        —— 整屏一张大立绘，对话变成浮在下方的小气泡，
 *                      顶栏 / 底栏默认全部隐藏，**长按屏幕**才浮出来
 *
 * ── 素材放哪 ──────────────────────────────────────────────────
 *   src/common/tachie/<id>.<后缀>
 *   例：normal.png   smile.png
 *
 *   建议 **竖构图**（宽:高 ≈ 0.68），和 ASPECT 一致最省心。
 *   尺寸不限，但同一个角色请用同一个画布尺寸，否则差分切换时会「跳」。
 *   透明底最佳；带底色的图会连底色一起显示。
 *
 * ── 表情差分 ──────────────────────────────────────────────────
 *   diff 里把「表情名」映射到「立绘 id」，说话时按当前情绪自动换图。
 *   没有映射（或只放了一张图）就回落到 DEFAULT_ID —— 单张立绘也能用。
 *
 * ── 想加立绘 ──────────────────────────────────────────────────
 *   1) 图丢进 src/common/tachie/
 *   2) id 加进 ITEMS
 *   3) 想让某个表情用它，在 DIFF 里加一行
 * ===============================================================
 */
import { getJSON, setJSON } from './store.js'

/** 素材后缀（不带点），和 emoji.js 的 EXT 一样可以换 jpg / webp */
export const EXT = 'png'

/** 立绘宽高比（宽 ÷ 高）。换素材尺寸时改这一个数 */
export const ASPECT = 0.68

/** 立绘清单 —— 顺序就是差分的顺序，第一个通常是常态 */
export const ITEMS = [
  { id: 'normal', name: '常态' },
  { id: 'smile', name: '微笑' },
  { id: 'shy', name: '害羞' },
  { id: 'sad', name: '低落' }
]

/** 兜底立绘：没有映射、或者 diff 里写了不存在的 id 时用它 */
export const DEFAULT_ID = 'normal'

/**
 * 表情 → 立绘差分。
 * key 是 emoji.js 里的表情名，value 是 ITEMS 里的 id。
 * 想「所有情绪共用一张」就把这张表整个删掉，只留 DEFAULT_ID。
 */
export const DIFF = {
  idle: 'normal',
  happy: 'smile',
  shy: 'shy',
  sad: 'sad',
  angry: 'sad',
  think: 'normal',
  cheer: 'smile',
  eat: 'smile',
  sing: 'smile',
  surprise: 'shy',
  sleep: 'normal',
  love: 'shy'
}

/**
 * 默认视图参数（用户调过之后会被存档覆盖）。
 *   size —— 立绘高度占画布高度的比例（1.0 = 整屏高）
 *   x/y  —— 立绘中心在画布上的相对位置（0~1）
 */
export const DEFAULT_VIEW = { size: 0.92, x: 0.5, y: 0.46 }

/** 缩放滑块的上下限（同样是「占画布高度」的比例） */
export const SIZE_MIN = 0.30
export const SIZE_MAX = 1.40

/** 有没有可用的立绘素材（没有就把「切换」键藏掉，退回纯表情包模式） */
export function hasTachie() {
  return ITEMS.length > 0
}

/** 拼立绘路径，例：/common/tachie/normal.png */
export function tachiePath(id) {
  return '/common/tachie/' + id + '.' + EXT
}

/** 按表情名取差分 id；没配就回落到 DEFAULT_ID */
export function diffIdFor(expr) {
  const id = DIFF[expr]
  return id || DEFAULT_ID
}

/* ---------------------------------------------------------------
 * 视图状态存档
 *   只存 mode / size / x / y 四个数，其它都从上面读。
 *   读写一律走 store.js（storage 的载荷形态各平台不一致）。
 * --------------------------------------------------------------- */

const KEY = 'pet_view'

/** 内存里那份，页面直接用 */
export const VIEW = { mode: 'emoji', size: DEFAULT_VIEW.size, x: DEFAULT_VIEW.x, y: DEFAULT_VIEW.y }

function num(v, dflt, lo, hi) {
  const n = typeof v === 'number' ? v : parseFloat(v)
  if (!isFinite(n)) return dflt
  return Math.min(Math.max(n, lo), hi)
}

/** 读存档；没有/坏了就给默认值。cb(VIEW) */
export function loadView(cb) {
  getJSON(KEY, function (o) {
    if (o) {
      VIEW.mode = o.mode === 'tachie' ? 'tachie' : 'emoji'
      VIEW.size = num(o.size, DEFAULT_VIEW.size, SIZE_MIN, SIZE_MAX)
      VIEW.x = num(o.x, DEFAULT_VIEW.x, -0.2, 1.2)
      VIEW.y = num(o.y, DEFAULT_VIEW.y, -0.2, 1.2)
    }
    if (cb) cb(VIEW)
  })
}

/** 写存档（拖动/滑动结束时调，不用每帧写） */
export function saveView(cb) {
  setJSON(KEY, { mode: VIEW.mode, size: VIEW.size, x: VIEW.x, y: VIEW.y }, cb)
}
