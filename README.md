# 桌宠框架 · Vela Pet Framework

> 跑在**小米手环 / 红米手表**上的桌宠快应用框架。
> 互动、消息、好感度、剧情分支这些「骨架」都写好了，你只需要填**台词、剧情和素材**。

[![Vela](https://img.shields.io/badge/platform-Xiaomi%20Vela-66ccff)](https://iot.mi.com/vela)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 这是什么

一个可以直接安装到手表上的**完整可运行应用**，也是一个可以照着改的**模板**。

它把「桌宠」这件事拆成了四层，每层都只有一两个文件：

| 层 | 文件 | 你要做的事 |
|---|---|---|
| 角色 | `src/config/character.js` | 改名字、头像、生日 |
| 文案 | `src/config/dialogue.js` | 填台词 |
| 剧情 | `src/config/stories.js` | 填分支对话 |
| 素材 | `src/common/emoji/` | 放表情图（任意尺寸） |

代码层面（页面布局、好感度结算、消息触发、存储读写）不用动。

**开箱即用**：所有占位内容都是能跑的示例 —— 台词写了示例句、表情是简笔画占位图、
剧情是 5 段带注释的样例。什么都不改也能装上手表看到完整效果，再一点点替换成自己的。

---

## 特性

- **互动**：点表情或气泡就说话，按时间/日期/饭点/情绪挑不同台词，表情会跟着内容变
- **消息中心**：每天最多自动冒一条新消息，未读置顶带红点，可重玩
- **好感度**：每日登录、时段互动、剧情选择都会加分；6 个等级，等级越高台词越亲密
- **剧情分支**：galgame 式选项对话，按选项累计分数结算三种结局
- **终章机制**（可选）：满好感先冒一段「？？？」彩蛋，玩完才放出最终消息
- **开发者模式**：一个开关把好感度拉满，方便看全部剧情
- **双版本**：正式版 / 开发者版包名不同，可以同时装、存档互不干扰
- **零依赖运行**：不联网、不上报，所有数据只存在手表的 storage 里

包体积约 **124 KB**（含 12 张表情占位图）。

---

## 快速开始

```bash
# 1. 装依赖（aiot-toolkit 是小米官方的 Vela 打包工具）
npm install

# 2. 编译出调试包
npm run build          # 产物：dist/com.example.velapet.debug.1.0.0.rpk

# 3. 装到手表
#    用「小米运动健康」App 的「应用管理 → 本地安装」选这个 rpk，
#    或者用 aiot-toolkit 的 debug 命令推到已连接的表上
```

环境要求：Node.js ≥ 8.10（推荐 18/20/22）。工具链会自动处理 `.ux` 文件的编译。

> 首次 `npm run build` 会有几条 `Label img must be closed` 的警告 ——
> Vela 的模板解析器对自闭合标签比较敏感，不影响产物，可以忽略。

---

## 目录结构

```
src/
├── manifest.json          应用名、包名、版本、designWidth
├── app.ux                 应用生命周期
├── config/                ← 你要改的基本都在这里
│   ├── character.js       角色名 / 头像 / 生日 / 终章配置
│   ├── dialogue.js        全部台词
│   ├── stories.js         全部剧情分支
│   ├── emoji.js           表情清单与帧数
│   ├── mood.js            情绪关键词 → 表情
│   ├── affinity.js        好感度规则与等级表
│   ├── inbox.js           消息触发、排序、已读
│   ├── dates.js           节日 / 星期 / 农历判断
│   ├── theme.js           配色与光斑
│   ├── store.js           storage 安全读写（别绕过它）
│   ├── build-mode.js      正式版/开发者版（自动生成）
│   ├── device-target.js   目标机型分辨率（自动生成）
│   └── story-meta.js      剧情索引（自动生成）
├── pages/
│   ├── index/             主页：表情 + 气泡 + 好感胶囊
│   ├── inbox/             消息列表
│   ├── chat/              聊天页（分支对话）
│   ├── settings/          设置
│   └── about/             关于
└── common/
    ├── emoji/             表情图 <名字>_<帧号>.png
    └── img/               图标与光斑

tools/                     辅助脚本（见下方）
docs/                      详细文档
```

---

## 换角色：三步

### 1. 改角色信息

`src/config/character.js`：

```js
export const CHARACTER = {
  name: '小助手',            // 聊天页、设置页显示的名字
  playerName: '你',          // 她怎么称呼你
  appName: '桌宠框架',        // 关于页标题
  tagline: '自备素材与文案的桌宠框架',
  avatar: '/common/img/icon.png',
  tapHint: '点我一下嘛～',
  typingHint: '正在输入…',
  birthday: null,            // [月, 日]，填 null 就没有生日事件
  finale: { eggId: '', finalId: '', minAff: 180 }   // 终章机制，留空即关闭
}
```

顺手把 `src/manifest.json` 里的 `name` 和 `package` 也换成你自己的
（`package` 建议用反域名，例如 `com.yourname.pet`）。

### 2. 填台词

`src/config/dialogue.js` 里每个数组都是一个台词池，随机抽一条。全部换成你的话就行，
格式和 key 名**不要改**（每段上方都写了「谁在用它」）。

支持两个占位符：`{nick}` → 玩家名，`{n}` → 数字（连续登录天数）。

### 3. 换表情图

把图片丢进 `src/common/emoji/`，命名 `<名字>_<帧号>.png`，再登记到
`src/config/emoji.js` 的 `EMOJI` 数组。详细规范见 [docs/ASSETS.md](docs/ASSETS.md)。

---

## 写剧情

`src/config/stories.js` 里已经放了 5 段样例，覆盖了全部触发方式：

| 样例 | 演示什么 |
|---|---|
| `sample_slot` | 时段触发 + 两个选择点 + 三结局（**带逐行注释，照着改**） |
| `sample_date` | 只在特定日期（周末）出现 |
| `sample_aff` | 好感度门槛（`minAff`） |
| `sample_egg` | 终章前的「？？？」彩蛋 |
| `sample_final` | 彩蛋通关后才放出的最终消息 |

一个 step 有三种形态：`{say, next}` 说下去、`{say, choices}` 弹选项、`{say, finish}` 结算结局。
选项的 `score` 累加：总分 ≥ 2 走 good，≤ -1 走 bad，其余 normal。

**改完 `stories.js` 必须重跑：**

```bash
node tools/gen_story_meta.mjs     # 重建消息列表用的索引
node tools/check_stories.mjs      # 校验断链 / 死循环 / 不可达分支
```

---

## 素材规范（尺寸不设限）

| 项目 | 要求 |
|---|---|
| 尺寸 | **任意**。页面用 `object-fit: contain`，等比缩放、不裁不变形 |
| 比例 | 方形、竖长、横宽都行 |
| 底色 | 建议透明 PNG（叠在黑色毛玻璃上，白底会露一块方框） |
| 格式 | 默认 PNG，也支持 JPG / WEBP（改 `emoji.js` 的 `EXT`） |
| 帧数 | **可选**。只放一张 `<名字>_0.png` 就是静态图；要动画就放 `_0.._n-1` 再到 `FRAMES` 登记 |
| 建议尺寸 | 显示边长 1.5 倍以上（手表最大约 235 设计 px，200~400px 比较合适） |

---

## 好感度

| 行为 | 加分 |
|---|---|
| 每天首次打开 | +3 |
| 每个时段首次点她 | +1（每天最多 4 分） |
| 剧情首次通关 | 按选项分数换算（-4 ~ +6） |
| 重玩但刷新最好结局 | 上面的一半 |

等级线在 `src/config/affinity.js` 的 `LEVELS`：

| Lv | 1 初识 | 2 熟悉 | 3 亲近 | 4 交心 | 5 默契 | 6 唯一 |
|---|---|---|---|---|---|---|
| 需要 | 0 | 16 | 40 | 75 | 120 | 180 |

想改节奏就改这张表的 `need`，其它地方会自动跟着变。

---

## 适配机型

| 设备 | 分辨率 | 表情建议边长 |
|---|---|---|
| 小米手环 10 | 212 × 520 | 178 |
| 小米手环 10 Pro（横屏） | 480 × 336 | 146 |
| 红米手表 4 | 390 × 450 | 201 |
| 红米手表 5 / 6 | 432 × 514 | 235 |

> 红米手表 5 和 6 分辨率相同，**运行时无法区分**，所以按更保守的 Watch 5 设计，一款包通吃。

布局是按 `designWidth: 480` 写的，运行时用 `TARGET = {W, H}` 按机型重算所有尺寸。
加机型：改 `tools/build_models.py` 的 `MODELS` 表即可。

---

## 打包与签名

```bash
# 调试包（内置调试签名，不需要密钥）
npm run build

# 正式包（需要自己的密钥）
python tools/gen_sign_key.py     # 生成 sign/private.pem + sign/certificate.pem
npm run release

# 一次出四个机型 + 一个开发者版
python tools/build_models.py     # 产物在 packages/
```

`sign/` 已在 `.gitignore` 里。**换密钥 = 手表会当成另一个应用，老存档不会迁移**，
同一个包名 + 同一把密钥才认作同一个应用。

---

## 工具脚本

| 脚本 | 作用 |
|---|---|
| `tools/gen_placeholder_emoji.py` | 重新生成 12 张简笔画占位表情 |
| `tools/gen_icons.py` | 生成界面图标与应用图标 |
| `tools/gen_glow.py` | 生成毛玻璃用的光斑 PNG |
| `tools/gen_story_meta.mjs` | 从 `stories.js` 抽取消息列表索引（**改剧情必跑**） |
| `tools/check_stories.mjs` | 剧情图校验：断链、死循环、不可达分支、分数区间 |
| `tools/smoke_test.mjs` | 逻辑冒烟测试（不用手表、不用编译，42 项断言） |
| `tools/verify_layout.py` | 复算主页/列表的几何尺寸，改布局后用来核对 |
| `tools/build_models.py` | 分机型打包 |
| `tools/gen_sign_key.py` | 生成签名密钥 |

Python 脚本需要 Pillow（`pip install pillow`）。

---

## 已知限制

- **只支持手表类设备**（`deviceTypeList: ["watch"]`），没做手机版布局
- Vela 不支持 `backdrop-filter` 和 `linear-gradient`，毛玻璃效果是把模糊**预烘进 PNG** 实现的
- 农历节日用一张小表按年份查（默认只收录 2026、2027），表里没有的年份会自动跳过
- 表情动画靠 `setInterval` 逐帧换图，帧数越多越吃 CPU，建议 ≤ 12 帧

---

## 文档

- [docs/ASSETS.md](docs/ASSETS.md) —— 素材制作规范（尺寸、帧、透明、体积）
- [docs/CUSTOMIZE.md](docs/CUSTOMIZE.md) —— 逐文件改造指南
- [docs/PITFALLS.md](docs/PITFALLS.md) —— **Vela 踩坑清单，改代码前先看这个**

---

## 许可

代码以 [MIT](LICENSE) 发布。

**素材与角色形象不在此列** —— 框架自带的 12 张表情和图标是程序生成的简笔画占位图，
可以随意使用；但你替换进去的美术素材、角色形象、台词文本的版权归你（或原权利人）所有，
请自行确认是否有权分发。
