/**
 * 统一视觉主题（v2.9.0）：纯黑底 + 黑色毛玻璃 + 大圆角
 *
 * 为什么这么实现：
 *   · Vela 不支持 `backdrop-filter`（编译器直接报 "Style name `backdrop-filter` is not supported"）
 *   · Vela 也不支持 `linear-gradient`（background-image 只接受 none / url(...)）
 *   · `filter: blur()` 能编译过，但它模糊的是元素**自身和子元素**，
 *     不是「背后的东西」，拿来做毛玻璃只会把文字一起糊掉
 *
 * 所以「黑色高斯模糊」用三层堆出来：
 *   ① 纯黑底（#000）
 *   ② 预烘好的高斯光斑 PNG（common/img/glow.png，tools/gen_glow.py 生成）
 *      —— 模糊已经烧进图片里，运行时零开销
 *   ③ 盖在上面的半透明白色玻璃面板：rgba(255,255,255,0.05~0.16) + 1px 亮边
 *      面板把光斑压暗一层 → 就是毛玻璃
 *
 * 圆角一律取「短边的 0.34~0.5」，不要再用 0.24 那种小圆角。
 */

/** 颜色表（全部是无彩度黑灰，只有 accent 是强调色 —— 想换配色改这里） */
export const C = {
  bg: '#000000',
  /* 玻璃面板：数字越小越透、越暗 */
  glass: 'rgba(24,24,27,0.80)',
  glassHi: 'rgba(46,46,52,0.84)',      // 强调 / 选中的那块
  glassLo: 'rgba(13,13,15,0.70)',      // 置灰 / 未解锁
  /* 亮边：毛玻璃的关键，没有它就只是一块灰方块 */
  line: 'rgba(255,255,255,0.12)',
  lineHi: 'rgba(255,255,255,0.22)',
  lineLo: 'rgba(255,255,255,0.06)',
  /* 文字 */
  t1: '#f3f3f6',      // 主
  t2: '#9a9aa3',      // 次
  t3: '#5b5b64',      // 弱 / 置灰
  /* 点缀 */
  accent: '#66ccff',  // 强调色，只给好感度进度条（换配色改这里）
  red: '#ff4d4f'
}

export const GLOW_SRC = '/common/img/glow.png'

/**
 * 一个高斯光斑的定位样式。
 * 中心 (cx, cy)、直径 d、透明度 op。
 *
 * ★ 一定要夹在画布内 —— 装饰层越界会把页面撑出可滑动空间
 *   （v2.2 那次「上下能滑」就是流沙圆越界导致的）
 */
export function glowStyle(cx, cy, d, cw, ch, op) {
  const dd = Math.max(1, Math.min(d, Math.min(cw, ch)))
  const x = Math.min(Math.max(cx - dd / 2, 0), Math.max(0, cw - dd))
  const y = Math.min(Math.max(cy - dd / 2, 0), Math.max(0, ch - dd))
  return 'left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;width:' +
    Math.round(dd) + 'px;height:' + Math.round(dd) + 'px;opacity:' + op + ';'
}
