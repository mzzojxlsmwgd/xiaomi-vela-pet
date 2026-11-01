/**
 * 表情素材清单
 * ===============================================================
 * 这个文件只做三件事：
 *   1) 声明「有哪些表情」（EMOJI）
 *   2) 声明「每套几帧」（FRAMES，默认 1 帧 = 静态图）
 *   3) 拼出图片路径（emojiPath）
 *
 * ── 素材放哪 ──────────────────────────────────────────────────
 *   src/common/emoji/<名字>_<帧号>.<后缀>
 *   例：happy_0.png   happy_1.png   happy_2.png
 *   帧号从 0 开始、必须连续。1 帧就只放 happy_0.png。
 *
 * ── 尺寸 / 格式 ───────────────────────────────────────────────
 *   不限制。页面里图片是 `object-fit: contain`，等比缩放、不裁不变形，
 *   方形、竖长、横宽、透明底、白底都能直接用。
 *   建议给到显示尺寸的 1.5 倍以上，省得放大发虚
 *   （手表最大约 235 设计 px，即 200~400px 边长比较合适）。
 *
 *   格式默认 PNG，也支持 JPG / WEBP —— 改下面的 EXT 即可，
 *   同一个角色请统一用一种后缀，混用要在 FRAMES 之外再单独指定（见下）。
 *
 * ── 想加表情 ──────────────────────────────────────────────────
 *   1) 把图丢进 src/common/emoji/
 *   2) 名字加进 EMOJI 数组
 *   3) 帧数 > 1 的，在 FRAMES 里登记
 *   4) 想让它有专属台词，去 config/dialogue.js 的 EXPR_LINES 里加同名 key
 *   第 4 步可以省，缺了会回落到 EXPR_LINES.idle。
 * ===============================================================
 */

/** 素材后缀（不带点）。换成 'jpg' / 'webp' 时所有表情都要跟着换 */
export const EXT = 'png'

/**
 * 表情名清单 —— 顺序无所谓，抽取时是等概率随机。
 * 框架内置 12 个**通用情绪**，不带任何角色特征，换角色也不用改名字。
 * 你可以加、可以删，但至少要留 1 个，且必须有一个叫 idle（兜底用）。
 */
export const EMOJI = [
  'idle',      // 待机 / 默认
  'happy',     // 开心
  'shy',       // 害羞
  'sad',       // 难过
  'angry',     // 生气
  'think',     // 思考
  'cheer',     // 打气 / 加油
  'eat',       // 吃饭
  'sing',      // 唱歌
  'surprise',  // 惊讶
  'sleep',     // 困倦
  'love'       // 喜欢
]

/**
 * 好感度低的时候不出现的表情（太亲密了，先藏起来）。
 * 框架默认留空 —— 全年龄角色不需要分级。
 * 想分级就把名字填进来，等级 < 3 时不会抽到。
 */
export const EMOJI_HI = []

/**
 * 每套有几帧。
 * **不写就是 1 帧（静态图）** —— 只放一张 PNG 也能跑，
 * 动画是可选项，不是必需品。
 *
 * 想加动画：把 <名字>_0..<n-1> 都放好，然后在这里登记帧数。
 * 注意不要登记比实际文件多，否则会请求到不存在的图。
 */
const FRAMES = {
  // happy: 4,
  // sing: 6
}

/** 默认帧数：没在 FRAMES 里登记的按这个算 */
const DEFAULT_FRAMES = 1

/** 每套有几帧 */
export function framesOf(name) {
  const n = FRAMES[name] || DEFAULT_FRAMES
  return n > 0 ? n : 1
}

/**
 * 拼图片路径。
 * @param {string} name 表情名（必须在 EMOJI 里）
 * @param {number} frame 帧号，越界会自动绕回
 * @returns {string} 例：/common/emoji/happy_0.png
 */
export function emojiPath(name, frame) {
  const n = framesOf(name)
  const f = ((frame | 0) % n + n) % n
  return '/common/emoji/' + name + '_' + f + '.' + EXT
}
