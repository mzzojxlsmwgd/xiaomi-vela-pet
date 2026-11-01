# 逐文件改造指南

按「改什么 → 去哪个文件 → 注意什么」的顺序看。**先读 [PITFALLS.md](PITFALLS.md) 再动手。**

---

## 数据流总览

```
                  ┌──────────────┐
                  │ character.js │  角色名 / 头像 / 生日 / 终章配置
                  └──────┬───────┘
                         │
   ┌─────────────────────┼─────────────────────┐
   │                     │                     │
┌──▼──────────┐   ┌──────▼──────┐   ┌──────────▼────────┐
│ dialogue.js │   │  emoji.js   │   │   stories.js      │
│ 台词池      │   │ 表情清单    │   │   剧情分支树       │
└──┬──────────┘   └──────┬──────┘   └──────────┬────────┘
   │                     │                     │
   │              ┌──────▼──────┐        ┌─────▼──────────┐
   │              │  mood.js    │        │ gen_story_meta │
   │              │ 情绪→表情   │        │ → story-meta.js│
   │              └──────┬──────┘        └─────┬──────────┘
   │                     │                     │
┌──▼─────────────────────▼─────────────────────▼──┐
│                  pages/index                     │  主页：说话 + 换表情
│                  pages/inbox                     │  消息列表
│                  pages/chat                      │  分支对话
└──────────────┬───────────────────────────────────┘
               │
        ┌──────▼───────┐    ┌──────────────┐
        │ affinity.js  │    │  store.js    │
        │ 好感度/等级  │◄───│ storage 封装 │
        └──────────────┘    └──────────────┘
```

---

## `config/character.js` —— 先改这个

| 字段 | 说明 |
|---|---|
| `name` | 角色名，出现在设置页、关于页、消息列表空态 |
| `playerName` | 她怎么称呼玩家（台词里的 `{nick}` 就是它） |
| `appName` | 关于页标题，建议和 `manifest.json` 的 `name` 一致 |
| `tagline` | 关于页副标题 |
| `avatar` | 头像路径，任意尺寸 |
| `tapHint` | 主页气泡的初始文字（还没说话时显示） |
| `typingHint` | 聊天页「正在输入…」的文案 |
| `birthday` | `[月, 日]`，触发 `birthday` 日期事件；`null` 关闭 |
| `finale` | 终章机制：`{eggId, finalId, minAff}`，两个 id 留空即关闭 |

改完记得同步 `src/manifest.json` 的 `name` / `package`。

---

## `config/dialogue.js` —— 全部台词

13 个导出，每个都是一组台词池。**key 名不要改**（和代码判断一一对应），
只替换数组里的字符串。

| 导出 | 什么时候说 | 关键约束 |
|---|---|---|
| `WELCOME` | 首次打开 | — |
| `LOGIN_LINES` | 每天打开 | 三分支：`streak` / `comeback` / `again`；`streak` 可用 `{n}` |
| `LEVEL_UP_LINES` | 好感升级 | key 是等级 2~6 |
| `TIME_LINES` | 点她 | 7 个时段 key，必须和 `timeSlot()` 一致 |
| `MEAL_LINES` | 饭点 | `breakfast` / `lunch` / `dinner` |
| `HEART_LINES` | 点她（情绪向） | 和 `CHEER_LINES` 共用一次抽取（75:25） |
| `CHEER_LINES` | 点她（打气向） | — |
| `SONG_LINES` | 点她（聊作品） | 涉及真实作品请自己核对事实 |
| `CHAT_LINES` | 点她（闲聊） | 也是兜底池 |
| `EXPR_LINES` | 点她（先换表情） | key 必须是 `emoji.js` 里的表情名 |
| `BOND_LINES` | 点她（好感向，Lv≥2） | key 是等级 1~6 |
| `ABOUT_LINES` | 关于页 | 一行一条 |
| `DATE_LINES` | 点她（节日/周末） | key 必须和 `dates.js` 的 `eventsOf()` 一致 |

主页点一下的抽取顺序（概率写在 `pages/index/index.ux` 的 `onTap`）：

```
日期 14% → 饭点 22% → 表情 26% → 好感 20%（Lv≥2）→ 情绪 14% → 聊作品 12% → 闲聊 12% → 时段兜底
```

想调节奏就改这些数字，别在台词里做手脚。

---

## `config/stories.js` —— 剧情分支

完整字段说明在文件头注释里。这里只列**最容易搞错的四件事**：

1. **`id` 是存储键**，上线后改了老存档就对不上（表现为「玩过的剧情又变成没玩过」）
2. **每个分支都必须能走到 `finish`**，否则玩家会卡在死路 —— `tools/check_stories.mjs` 会查
3. **`score` 的阈值写死在 `pages/chat/chat.ux`**（≥2 good / ≤-1 bad），改阈值要去那边
4. **`slots: []` + 没有 `dates` = 永远不会自动触发** —— 只有终章彩蛋那种走专用通道的才该这样

改完：

```bash
node tools/gen_story_meta.mjs
node tools/check_stories.mjs
```

---

## `config/emoji.js` —— 表情清单

- `EMOJI`：有哪些表情。至少要有一个 `idle`
- `EMOJI_HI`：好感度低时不出现的（默认留空，全年龄角色用不上）
- `FRAMES`：每套几帧，**不写就是 1 帧**
- `EXT`：素材后缀

---

## `config/mood.js` —— 情绪匹配

`RULES` 是有序数组，**先到先得**。规则顺序 = 优先级，所以：

- 语气强的排前面（「别走」「求求你」要压过「想」「听」）
- 「想」这种宽泛词放最后
- 一条都没命中 → 主页用 fallback，聊天页只有 25% 概率贴中性表情

新增规则时，`e` 里的表情名必须在 `EMOJI` 里。

---

## `config/affinity.js` —— 好感度

```js
export const LEVELS = [
  { lv: 1, name: '初识', need: 0,   hint: '...' },
  ...
]
export const SLOT_CAP = 4      // 每天最多靠时段互动拿几分
export const MAX_AFF = 999
```

- 改 `need` 会连带影响所有 `minAff` 剧情和 `finale.minAff` 的体感，改之前先算一遍
- `hint` 显示在设置页的好感度面板
- **不要绕过这个文件直接读写 `lt_aff`** —— 它是进程内单例 + 串行写盘，绕过去会有竞态

---

## `config/dates.js` —— 节日判断

- 固定公历日直接加 `if (m === X && day === Y) ev.push('xxx')`
- 农历节日走 `LUNAR` 小表，按年查；**表里没有的年份会自动跳过**
- 新增的事件 key 要在 `dialogue.js` 的 `DATE_LINES` 里补台词，否则那天会静默跳过
  （`onTap` 里取第一个「有台词的」事件）

---

## `config/theme.js` —— 配色

```js
export const C = {
  bg: '#000000',
  ...
  accent: '#66ccff',   // 唯一允许的彩色，只给好感度进度条
  red: '#ff4d4f'       // 未读红点
}
```

改配色只改这里。注意 [PITFALLS 第 5 条](PITFALLS.md)：**不支持 `backdrop-filter` 和
`linear-gradient`**，毛玻璃是预烘 PNG 做的，不是 CSS。

---

## `config/inbox.js` —— 消息触发

- `maybeTrigger`：每天最多冒一条；日期剧情 50% 概率；优先挑没玩过的
- `buildList`：正式版只列「收到过」的，开发者版列全量
- `markDone`：玩完记次数、刷最好结局、置顶；**彩蛋通关在这里解锁最终消息**
  （放在这里而不是聊天页，是为了「只要玩完就一定解锁」，不管从哪个入口进）

---

## 页面

| 页面 | 改什么 |
|---|---|
| `pages/index` | `onTap` 的抽取概率、`applySizes` 的布局比例 |
| `pages/inbox` | 每页几行（`perPage`）、行高 |
| `pages/chat` | 打字速度、贴纸概率（`STICKER_CHANCE`）、结局分数阈值 |
| `pages/settings` | 好感度面板 + 关于；**不要加 `<scroll>`** |
| `pages/about` | 版本号、许可信息 |

---

## 上线前检查

```bash
npm test                         # 42 项逻辑断言：配置 key 一致性 / 触发 / 终章 / 好感度
node tools/check_stories.mjs     # 剧情图无断链
python tools/verify_layout.py    # 布局几何无越界（改了 index/inbox 才需要）
npm run build                    # 编译通过
```

再加三条人工确认：

1. 手表上打开 → 点表情 → 有台词、表情有变化
2. 设置页每一项都能点（验证没有 `<scroll>` 吞点击）
3. 装一次 → 卸载 → 再装，好感度没有异常归零（验证 storage 读写正确）
