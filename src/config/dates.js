/**
 * 日期事件：判断「今天是什么日子」，供台词与剧情触发使用
 *
 * 两类来源：
 *   1) 固定公历日（元旦 / 情人节 / 圣诞 / 周末 / 周一 / 月初月末 …）
 *      角色生日也走这里，日期在 config/character.js 的 birthday 里配
 *   2) 农历节日（春节 / 除夕 / 端午 / 七夕 / 中秋）—— 公历每年不同，用一张小表按年份查
 *
 * ⚠️ LUNAR 只收录已核实的年份（2026、2027）。要扩展就按同样格式往表里加一年即可；
 *    表里没有的年份会自动跳过农历节日，只走公历 + 星期逻辑。
 */
import { CHARACTER } from './character.js'

export const LUNAR = {
  2026: { chuxi: [2, 16], chunjie: [2, 17], duanwu: [6, 19], qixi: [8, 19], zhongqiu: [9, 25] },
  2027: { chuxi: [2, 5], chunjie: [2, 6], duanwu: [6, 9], qixi: [8, 8], zhongqiu: [9, 15] }
}

/** 返回今天的日期事件数组，可能为空，也可能有多个（如「春节」+「周末」） */
export function eventsOf(d) {
  const m = d.getMonth() + 1
  const day = d.getDate()
  const w = d.getDay()
  const y = d.getFullYear()
  const ev = []

  /* ---- 固定公历 ---- */
  if (m === 1 && day === 1) ev.push('newyear')
  if (m === 1 && (day === 1 || day === 2)) ev.push('newyear_break')
  if (m === 2 && day === 14) ev.push('valentine')
  if (m === 3 && day === 14) ev.push('white_day')
  if (m === 4 && day === 1) ev.push('aprilfool')
  if (m === 5 && (day === 20 || day === 21)) ev.push('love520')
  if (m === 6 && day === 1) ev.push('children')
  const bd = CHARACTER.birthday
  if (bd && m === bd[0] && day === bd[1]) ev.push('birthday')
  if (m === 9 && day === 10) ev.push('teachers')
  if (m === 10 && day === 1) ev.push('national')
  if (m === 10 && day === 31) ev.push('halloween')
  if (m === 11 && day === 11) ev.push('double11')
  if (m === 12 && day === 24) ev.push('xmas_eve')
  if (m === 12 && day === 25) ev.push('xmas')
  if (m === 12 && day === 31) ev.push('yearend')

  /* ---- 农历（查表） ---- */
  const L = LUNAR[y]
  if (L) {
    if (L.chuxi && L.chuxi[0] === m && L.chuxi[1] === day) ev.push('chuxi')
    if (L.chunjie && L.chunjie[0] === m && L.chunjie[1] === day) ev.push('chunjie')
    if (L.duanwu && L.duanwu[0] === m && L.duanwu[1] === day) ev.push('duanwu')
    if (L.qixi && L.qixi[0] === m && L.qixi[1] === day) ev.push('qixi')
    if (L.zhongqiu && L.zhongqiu[0] === m && L.zhongqiu[1] === day) ev.push('zhongqiu')
  }

  /* ---- 星期 / 月头月尾 ---- */
  if (w === 6 || w === 0) ev.push('weekend')
  if (w === 1) ev.push('monday')
  if (w === 5) ev.push('friday')
  if (day === 1) ev.push('monthstart')
  if (day === new Date(y, m, 0).getDate()) ev.push('monthend')

  return ev
}

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 例：10月24日 周六 */
export function dateLabel(d) {
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WD[d.getDay()]
}

/** 例：10/24 */
export function shortDate(d) {
  const m = d.getMonth() + 1
  const day = d.getDate()
  return (m < 10 ? '0' + m : m) + '/' + (day < 10 ? '0' + day : day)
}
