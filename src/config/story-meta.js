/**
 * 剧情元信息（自动生成，勿手改）。
 * 由 tools/gen_story_meta.mjs 从 stories.js 抽取 —— 改完 stories.js 记得重跑。
 *
 * 只保留消息列表 / 触发判定需要的字段；完整分支树在 stories.js（仅 chat 页引用）。
 */
export const STORY_META = [
  { id: "sample_slot", title: "示例：今天过得怎么样", icon: "happy", slots: ["evening", "night"] },
  { id: "sample_date", title: "示例：周末", icon: "idle", slots: ["morning", "noon"], dates: ["weekend"] },
  { id: "sample_aff", title: "示例：熟起来之后", icon: "love", slots: ["night"], minAff: 40 },
  { id: "sample_egg", title: "？？？", icon: "think", slots: [], minAff: 180 },
  { id: "sample_final", title: "示例：最后一段", icon: "love", slots: ["night", "late"], minAff: 180 }
]

/** 最长标题的字数（消息列表按它决定标题字号，避免末尾被裁） */
export const MAX_TITLE_LEN = 10

/** 按 id 找元信息 */
export function metaOf(id) {
  for (let i = 0; i < STORY_META.length; i++) {
    if (STORY_META[i].id === id) return STORY_META[i]
  }
  return null
}
