# 更新日志

本项目的版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
日期格式 `YYYY-MM-DD`。

---

## [1.0.0] — 2026-11-08

首个可发行版本。

### 骨架

- **互动**：点表情或气泡说话，按日期 / 饭点 / 时段 / 情绪挑台词，表情跟着内容变
- **消息中心**：每次登录按 `1 ÷ 可触发对话数` 判定，普通剧情每天上限 3 条；未读置顶带红点，可重玩
- **好感度**：每日登录 +3、每时段首点 +1（每天上限 4）、剧情按选项 −4 ~ +6；6 个等级
- **剧情分支**：galgame 式选项对话，分数累计结算三种结局
- **终章机制**（可关）：满好感先冒「？？？」彩蛋，玩完才放出最终消息
- **开发者模式**：一键拉满好感度、全剧情可看
- **双版本**：正式版 / 开发者版包名不同，可同装、存档互不干扰

### 适配

- 小米手环 10（212×520）、手环 10 Pro（480×336 横屏）、红米手表 5 / 6（432×514）
- 页面运行时用 `device.getInfo` 精修尺寸，`TARGET` 只作为兜底
- 红米手表 5 与 6 分辨率相同、运行时无法区分 → 按更保守的 Watch 5 设计，一款包通吃
- `tools/build_models.py` 一次产出 4 个正式包 + 1 个开发者包

### 素材

- 12 套通用情绪占位表情（`idle` `happy` `shy` `sad` `angry` `think` `cheer` `eat` `sing` `surprise` `sleep` `love`）
- 单帧 PNG，页面用 `object-fit: contain` → 换素材不限制尺寸与比例
- 应用图标为**正圆**（手表桌面图标位是圆形遮罩，方角会被切掉）

### 工具链

- `tools/smoke_test.mjs` —— 42 项逻辑断言，用 Node loader hook 把 `@system.storage` 重定向到内存实现，
  不依赖真机、不依赖编译、不依赖 `node_modules`
- `tools/check_stories.mjs` —— 剧情图校验：断链、死循环、不可达分支、分数区间
- `tools/verify_layout.py` —— 四机型布局几何复算：高度不溢出、触摸目标 ≥ 40 物理px、标题放得下
- `tools/gen_story_meta.mjs` —— 从 `stories.js` 抽取消息列表索引（改剧情必跑）
- GitHub Actions 在每次 push / PR 上跑上面三项

### 文档

- `README.md` —— 快速开始、三步换角色、剧情写法、好感度规则、适配机型、打包签名
- `docs/ASSETS.md` —— 素材规范（尺寸、帧、透明、体积）
- `docs/CUSTOMIZE.md` —— 逐文件改造指南
- `docs/PITFALLS.md` —— **Vela 踩坑清单**，改代码前先看

### 已知限制

- 只支持手表类设备（`deviceTypeList: ["watch"]`），没有手机版布局
- Vela 不支持 `backdrop-filter` 与 `linear-gradient`，毛玻璃只能靠预烘 PNG 模拟，实机容易糊成一片灰 →
  默认纯黑底，`theme.js` 的 `glowStyle()` 留给想试的人
- 农历节日用一张小表按年份查（默认收录 2026、2027），表里没有的年份自动跳过
- 表情动画靠 `setInterval` 逐帧换图，建议 ≤ 12 帧
