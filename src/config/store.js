/**
 * storage 安全读写（v2.9.1）
 * ---------------------------------------------------------------
 * 为什么需要这一层：
 *   `@system.storage.get` 的 success 回调「载荷形态」在不同平台上不一致：
 *     · 快应用联盟标准：回调参数就是「值的字符串」→ success(data) { data === '...' }
 *     · 部分 Vela 实现：包了一层 → success(ret) { ret.data === '...' }
 *   以前所有地方都直接写 `ret.data`，如果平台给的是裸字符串，
 *   读到的永远是 undefined → JSON.parse 抛错 → 当成空存档。
 *
 *   于是出现两个看起来毫不相干、其实是同一个病根的 bug：
 *     ① 好感度：点一下数字变了（内存里加了），下次一读又是 0 → 「又归零了」
 *     ② 设置项：改了不生效，重新进来又变回默认 → 「所有选项都不能用」
 *
 *   这里两种形态都认，取不到就返回 ''（调用方按空处理）。
 * ---------------------------------------------------------------
 */
import storage from '@system.storage'

/** 从 success 回调参数里抠出「字符串值」，兼容裸字符串 / {data} / {value} / {result} */
export function valueOf(ret) {
  if (ret === null || ret === undefined) return ''
  if (typeof ret === 'string') return ret
  if (typeof ret === 'number' || typeof ret === 'boolean') return '' + ret
  if (typeof ret !== 'object') return ''
  const keys = ['data', 'value', 'result']
  for (let i = 0; i < keys.length; i++) {
    const v = ret[keys[i]]
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return '' + v
  }
  return ''
}

/**
 * 读一个 JSON 对象。
 * cb(obj|null) —— 没有、读失败、解析失败，一律给 null（绝不抛异常）
 */
export function getJSON(key, cb) {
  let done = false
  const finish = function (o) {
    if (done) return
    done = true
    cb(o)
  }
  try {
    storage.get({
      key: key,
      success(ret) {
        const s = valueOf(ret)
        if (!s) { finish(null); return }
        let o = null
        try { o = JSON.parse(s) } catch (e) { o = null }
        finish(o && typeof o === 'object' ? o : null)
      },
      fail() { finish(null) }
    })
  } catch (e) {
    finish(null)
  }
}

/** 读一个纯字符串（比如 lt_open 存的故事 id） */
export function getString(key, cb) {
  let done = false
  const finish = function (s) {
    if (done) return
    done = true
    cb(s || '')
  }
  try {
    storage.get({
      key: key,
      success(ret) { finish(valueOf(ret)) },
      fail() { finish('') }
    })
  } catch (e) {
    finish('')
  }
}

/** 写一个 JSON 对象。cb 只在「写结束」时调一次（成功失败都调，调用方不用区分） */
export function setJSON(key, obj, cb) {
  let done = false
  const finish = function () {
    if (done) return
    done = true
    if (cb) cb()
  }
  try {
    storage.set({
      key: key,
      value: JSON.stringify(obj),
      success: finish,
      fail: finish
    })
  } catch (e) {
    finish()
  }
}

/** 写一个纯字符串 */
export function setString(key, val, cb) {
  let done = false
  const finish = function () {
    if (done) return
    done = true
    if (cb) cb()
  }
  try {
    storage.set({
      key: key,
      value: '' + val,
      success: finish,
      fail: finish
    })
  } catch (e) {
    finish()
  }
}
