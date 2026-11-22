# Vela 踩坑清单

改代码前先看这一页。下面每一条都是**真机上踩过的**，不是理论推测。

---

## 1. `storage.get` 的返回值不一定是对象

**症状**：好感度点了会涨、回头又归零；设置项改了不生效；存档「永远像第一次打开」。

**原因**：`@system.storage.get` 的 `success` 回调载荷形态**不统一** ——
快应用联盟标准给的是**裸字符串**，部分实现才包一层 `{data: ...}`。

```js
// ✗ 错：拿到裸字符串时 ret.data 是 undefined → JSON.parse 抛错 → 当空存档
storage.get({
  key: 'lt_aff',
  success: function (ret) {
    const st = JSON.parse(ret.data)     // 这里炸
  }
})
```

```js
// ✓ 对：只走 config/store.js，它认裸串 / {data} / {value} / {result}
import { getJSON, setJSON } from './store.js'
getJSON('lt_aff', function (st) { /* st 一定是对象或 null */ })
```

**这条藏了三个版本才挖出来**，因为内存里算得都对，看起来像显示问题。
**规矩：全项目只准通过 `config/store.js` 碰 storage。**

---

## 2. 列表里不能用 `style="{{$item.x}}"` 承载布局

**症状**：列表行全部堆在同一个位置，或者样式只对第一行生效。

**原因**：Vela 的 `style` 绑定**只在节点创建时应用一次**，后续 diff 不会更新它。
`for` 列表复用了节点，于是后面的行拿不到新的样式值。

```html
<!-- ✗ 错：行高/宽度靠 $item 传进来 -->
<div class="row" for="{{list}}" style="{{$item.rowStyle}}">
```

```html
<!-- ✓ 对：布局用统一变量，差异用 class 切换 -->
<div class="row" for="{{list}}" style="{{sRow}}" key="{{$item.id}}">
  <text class="name {{$item.nameCls}}" style="{{sName}}">{{$item.title}}</text>
</div>
```

配套两条：
- `key` **不要用 `$idx`**，用数据本身的 id，否则重排时节点复用会错位
- 行内样式（`value` 也一样）都受这个限制，能不用就不用

---

## 3. `px` 是设计像素，不是物理像素

**原因**：`manifest.json` 里 `designWidth: 480`，运行时 `k = 480 / 屏幕物理宽`。
写 `width: 100px` 实际是「480 宽的画布上的 100px」，在 212 宽的手环 10 上会被放大 2.26 倍。

**规矩**：所有尺寸按 `k = 480 / sw` 换算，`值_css = 值_物理 × k`。
项目里统一走 `pages/index/index.ux` 的 `applySizes()`。

**别踩的坑**：`designWidth` 不要写成 `"device-width"` —— 装上会闪一下退回表盘。

---

## 4. 每个样式类都要显式写 `position`

Vela 的样式合并逻辑对 `position` 的处理和浏览器不同：如果某个类没写 `position`，
它会继承到别的类的定位行为，出现「明明写了 `top` 却不动」这种鬼现象。

**规矩**：`.ux` 里**每一个**样式类都显式写 `position: relative`（或 absolute / fixed）。

批量改样式时注意：脚本要先**去掉注释**再判断选择器，否则带注释的规则会漏。

---

## 5. 不支持 `backdrop-filter`，也不支持 `linear-gradient`

- `backdrop-filter` —— **编译直接报错**
- `linear-gradient` —— 不支持
- `filter: blur()` —— 能编译，但模糊的是**元素自身和子元素**，
  拿它做毛玻璃会把文字一起糊掉

**本项目怎么做的**：把高斯模糊**预烘进 PNG**（`tools/gen_glow.py` 生成 256px 径向柔光），
运行时用 `<image>` 放大 + 降 `opacity` 叠在黑底上，再盖一层
`rgba(255,255,255,0.05~0.17)` 的玻璃面板 + 1px 亮边。零运行时开销。

---

## 6. `<scroll>` 会吞掉点击

**症状**：设置页点不动；列表点了没反应。

**原因**：`<scroll>` 既会**堆叠子节点**（渲染重复），又会**抢走触摸事件**。
手表屏幕本来就小，滚动列表的收益远小于它带来的问题。

**本项目怎么做的**：全部改成**分页**（上一页 / 下一页按钮），消息列表和设置页都不用 `scroll`。

---

## 7. 装饰元素溢出会导致整页可以上下滑

**症状**：页面本来应该固定，却能上下拖动。

**原因**：光斑、光晕这类装饰 `<image>` 如果超出画布，会把页面的可滚动区域撑大。

**修法**：把装饰层的位置**全部夹在画布内**（`theme.js` 的 `glowStyle()` 做了钳制），
并且给 `.page` 加行内 `overflow: hidden`。

---

## 8. 引用一个已删除的变量会中断整个函数

**症状**：表情全部变成 0 尺寸；布局完全乱掉；控制台没有明显报错。

**原因**：`applySizes()` 里某一行 `this.sHalo = ... card ...` 引用了一个已经不存在的
局部变量 → `ReferenceError` → **整个 `applySizes` 直接中断**，后面的尺寸计算全都没执行。

**规矩**：改布局代码后，一定真机跑一遍；`applySizes` 这种「一次性算完所有尺寸」的函数，
任何一行抛错都是全局性故障。

---

## 9. 改完 `stories.js` 必须重跑索引脚本

`story-meta.js` 是 `stories.js` 的**轻量索引**（只含 id/title/icon/slots/dates/minAff），
消息列表用它，避免把 40KB 的分支树打进每个页面。

```bash
node tools/gen_story_meta.mjs
node tools/check_stories.mjs
```

忘了跑 → 新加的剧情在消息列表里根本不出现，而且**不会报错**。

---

## 10. 正式版和开发者版必须用不同包名

同一个包名、同一把签名密钥，装第二次会**覆盖并共用存档**。
想做「能同时装两个版本」，包名要不同（本项目：`...pet` 和 `...pet.dev`）。

另外：**换签名密钥 = 手表认为是另一个应用**，老存档不会迁移。

---

## 11. 模板里的 `<image>` 建议自闭合

写成 `<image ... />`。不写 `/` 也能编译，但每次构建都会刷一串
`Label img must be closed` 的警告，容易把真正的错误淹掉。

---

## 12. `object-fit: contain` 是可用的

这条是好消息：`<image>` 支持 `object-fit`，所以**任意尺寸、任意比例**的素材都能
等比缩放塞进容器，不会变形、不会裁切。项目里所有表情/头像都用了它 ——
这意味着你换素材时**完全不用管原图多大**。

---

## 13. `border-radius` 必须和 `border-width` + `border-color` 写在一起

**这是最容易踩、也最让人怀疑「代码没错啊」的一条。**

官方文档原文：

> `border-radius` 属性允许你设置元素的外边框圆角。**设置时需要同时设置 `border-width`、
> `border-color`**；单独设置 `border-[left|top|right|bottom]-width`、`-color` 时
> `border-radius` 无效。

引擎是**解析同一条样式声明**时判断的。所以下面这种写法会失效：

```html
<!-- ✗ 圆角在 CSS 类里，边框在另一个类里 → 圆角被忽略，元素是直角 -->
<div class="card" style="border-radius:20px"></div>

<style>
  .card { background-color: rgba(255,255,255,.06); border-width: 1px; }
</style>
```

**正确写法**：三件套紧挨着放在同一个 `style` 里。

```html
<!-- ✓ -->
<div style="border-width:1px;border-color:rgba(255,255,255,.14);border-radius:20px"></div>
```

如果元素**不需要可见边框**，给一个几乎透明的颜色就行，圆角照样生效：

```js
'border-width:1px;border-color:rgba(255,255,255,0.06);border-radius:' + r + 'px;'
```

红点、进度条这类元素用**同色边框**（`border-color` = 背景色），
既出了圆角，视觉尺寸又不变。

**为什么容易漏**：浏览器完全没这条限制，所以 `preview/index.html` 里圆角是好的，
装到手表上才发现全是方块 —— 会误以为是打包或设备问题。

**自检**：`grep -n border-radius src/pages/*/*.ux`，每一处往前 130 个字符内
必须同时出现 `border-width` 和 `border-color`。

---

## 14. 同一个样式变量可能被赋值两次

`settings.ux` 的 `sBarIn`（好感度进度条）在 `onInit` 里初始化成 `width:0px`，
真正生效的是 `loadAffInfo` 里按好感度重算的那一次。改错那一处等于没改。

→ 改样式前先 `grep "sXxx ="` 数一下赋值次数；或者直接看编译产物里那一段字符串。

---

## 15. `<text>` 一定要显式写 `line-height`

不写就用设备默认行高，各平台在 1.3~1.5 之间不等。后果：

- 顶栏三行文字的实际高度比算出来的大 → 返回键被顶出屏幕
- 固定行高的列表里文字上下被裁
- 预览（浏览器默认约 1.2）和实机对不上

→ 每个带 `font-size` 的 `text` 都补上 `line-height:字号 × 1.3~1.35`。

---

## 16. 不要用动态 `class` 去改 `flex-direction`

窄屏（手环 10）主页顶栏要一行变两行，直觉写法是：

```html
<div class="topbar {{topCls}}" style="{{sTopbar}}">
```

`topCls` 在 `device.getInfo` 回调里从 `top-row` 改成 `top-col`。
**问题**：`flex-direction` 决定的是整棵子树的排列方式，Vela 在样式热更新时只重算几何、
不重建节点，改完经常还是原来的方向（浏览器里完全正常，实机不动）。

**正确写法**：两套结构，用 `if` 二选一。`if` 编译成 `shown()`，切换时是**销毁重建**，
方向一定跟着变：

```html
<div class="topbar" if="{{wide}}" style="{{sTopbar}}">…一行版…</div>
<div class="topbar topbar-col" if="{{narrow}}" style="{{sTopbar}}">…两行版…</div>
```

模板里别写 `if="{{!narrow}}"` —— 加一个 `wide` 布尔量更稳（省得表达式引擎各版本行为不一）。

**连带注意**：两行的总高要重算进 `topH`，否则下面舞台区会算多、整页溢出：

```js
const topH = narrow ? (btn + rowGap + affH + pad * 2) : (btn + pad * 2)
```

---

## 17. `<text>` 没有 `lines` 属性，行数只能走样式

直觉写法是给标签加属性：

```html
<text lines="3">…</text>
```

**编译直接报错**：

```
Component `text` does not support attribute `lines`.
The supported attributes are [type, id, style, class, disabled, if, elif, else, for, tid, show, …]
```

行数只能写进样式（内联或 class 都行），引擎会读：

```js
this.sChoiceT = 'font-size:' + optFs + 'px;line-height:' + lineH +
  'px;width:' + innerW + 'px;text-align:center;lines:' + lines + ';'
```

## 18. 选项框别用 `padding` 定宽，改成内部文字定宽

```js
// 危险：width + padding 的盒模型各机型不一致
this.sChoice = 'width:' + optW + 'px;padding-left:' + padH + 'px;padding-right:' + padH + 'px;'
this.sChoiceT = 'width:' + (optW - padH * 2) + 'px;'
```

如果引擎把 `width` 当 **content-box**，选项框实际外宽 = `optW + 2*padH`，
比外层面板还宽 → 左右被裁，文字跟着被裁（表现为「末尾几个字看不见」）。

**改法**：框只定宽，不留 padding；文字自己定宽居中，两种盒模型下都不会溢出：

```js
this.sChoice = 'width:' + optW + 'px;height:' + optH + 'px;…'
this.sChoiceT = 'width:' + (optW - padH * 2) + 'px;text-align:center;lines:' + lines + ';'
```

## 19. 每行字数要按 ≥1.24em 保守估，否则卡在边界会裁字

```js
const perLine = Math.max(1, Math.floor(innerW / (optFs * 1.24)))
const lines = Math.min(3, Math.max(1, Math.ceil(maxLen / perLine)))
const optH = Math.max(minH, lines * lineH + padV * 2 + 4)   // +4 余量防行高误差
```

中文字宽名义上是 1em，但字体字距 + 标点挤压会让实际占位变宽。
按 1.16 估时，12 字的长句正好卡在边界：估算 1 行、实际排成 2 行，
而框高只留了 1 行 → 第二行整行看不见。**宁可多算一行，也不让字被裁。**

---

## 20. 胶囊圆角会削文字 —— 但别用「收窄文字宽度」去躲

选项框是胶囊（`border-radius: optH/2`）。圆角半径 = 半个高度，所以**左右各 optH/2
的范围是圆弧区**，那里可显示高度从中间向两端迅速收敛到 0。文字如果伸进圆弧区，
首尾几个字会被上下削掉，表现为「字被切了一半」。

**这里踩过一次大坑，记下来免得重走**：

v2.9.7 试过「把文字宽度收进直线段」——`innerW = optW - optH - 0.4fs`。
结果框越高半径越大、能放字的宽度越窄，`optH` 和 `innerW` 互相咬合，
必须迭代两三轮到收敛才稳定；而且宽度收得太狠，12 字的长句反而被挤成三行。
v2.9.8 又叠了「窄屏字号 0.70」，视觉上字小得难看。
**v2.9.9 把这些全部回退**，换了个思路：

> 文字是**单行或两三行、垂直居中**的。只要上下内边距（`optPadV`）足够，
> 字形根本够不到圆弧区 —— 圆弧只在靠近上下边缘的地方才有收敛。
> 所以正确做法不是收窄宽度，而是**留够上下留白 + 字号别太大**。

现在的写法（`chat.ux` 的 `layoutChoices()`）：

```js
const optW    = Math.round(DW * 0.76)
const optFs   = Math.max(11, Math.round(fs * 0.76))
const optPadH = Math.round(fs * 0.42)
const optPadV = Math.round(fs * (tight ? 0.34 : 0.46))
const innerW  = optW - optPadH * 2                 // 只扣左右内边距，不扣 optH
const perLine = Math.floor(innerW / (optFs * 1.24))
const lines   = Math.min(3, Math.ceil(maxLen / perLine))
const optH    = Math.max(Math.round(fs * 2.2), lines * lineH + optPadV * 2 + 4)
```

验算（手环 10：`fs = 27` 设计px）：`optW = 365`、`optH = 59`（单行）、半径 29.5、
文字行高 29 居中后上下各留 15px。在文字左端 `x = 18.5` 处圆弧的可用高度还有 54.8px，
文字只占 29px —— **绰绰有余**。两行、三行同理。

### 两个问题别混在一起调

| 问题 | 症状 | 解法 |
|------|------|------|
| 文字过长 | 一行放不下，第二行整行看不到 | 按最长那条算行数，把高度给够（系数用 1.24em 保守估） |
| 胶囊圆角 | 首尾字上下被切、字脚被压 | 留够 `optPadV` + 字号别顶满；**不要收窄 `innerW`** |

### 还有一种「圆角」不是控件的圆角

手环 10 的**屏幕**圆角半径 46 物理px。贴底的选项框 / 结算块 /「正在输入」
会落进屏幕圆弧里被切。这个只能靠 `margin-bottom` 整体上抬：

```js
this.lift = sw < 280 ? Math.round(fs * 1.8) : 0   // 手环 10 ≈ 22 物理px
```

上抬之后 `bottomHeight()` 的三个分支（typing / choices / end）**都要加 `lift`**，
否则底部内容会溢出画布。`lift` 必须在 `this.fs = fs` 之后立刻算出来 ——
`apply()` 里 `sTyping` 比 `layoutChoices()` 更早赋值，算晚了会拿到 `undefined`。

---

## 21. 应用图标必须是正圆，不能用圆角矩形

手表桌面的图标位是**圆形遮罩**。`icon.png` 如果画成圆角矩形，四个角会被遮罩切掉，
看起来像图标被啃了一口 —— 而且因为圆角矩形本身已经内缩了，切完剩下的可视区比预期更小。

正确做法：PNG 本身就画成**正圆、四角透明**，内圈装饰按圆底重新配比。

`tools/gen_icons.py` 里：

```python
# 圆角矩形（错）
d.rounded_rectangle([0, 0, n*S-1, n*S-1], radius=44*S, fill=BG)
# 正圆（对）
d.ellipse([0, 0, n*S-1, n*S-1], fill=BG)
```

改成正圆之后**内圈要跟着收**。圆角矩形的对角线能到 `96×√2 ≈ 136`，
正圆只有 96 —— 原来贴边的装饰环会顶到圆边上。经验值：最外圈装饰环收到 **75~78**（圆底半径 96），
留 20% 左右边距；表情/脸这类主体收到 46~48。

```python
for rr, a in [(75, 20), (65, 34), (57, 50)]:   # 三道环
    ...
fr = 46 * S                                     # 脸
```

尺寸固定 **192×192**，4 倍超采样后 `LANCZOS` 缩回去，边缘才不会有锯齿。

---

## 22. `package.json` 里千万别加 `"type": "module"` —— 编译产物会坏

**症状**：应用装上、桌面上有图标，一点就黑屏 / 闪一下退回表盘。代码怎么查都是对的。

**原因**：`"type": "module"` 会让 babel 把 `.js` 源码当 ESM 处理，输出 CJS 互操作代码时
用 **Node 的全局 `exports`**，而不是 webpack 模块包装的局部别名。而 Vela 运行时里
没有 `exports` 这个全局变量 → `app.js` 的 `onCreate` 一执行就抛 `ReferenceError` → 启动即退。

```js
// 有 "type": "module" 时编出来的（错）
621:(e,t,o)=>{ o.r(t), Object.defineProperty(exports,"__esModule",{...}), exports.CHARACTER={...} }
//                                          ^^^^^^^ 运行时不存在

// 去掉之后（对）
165:(e,t)=>{ Object.defineProperty(t,"__esModule",{...}), t.CHARACTER={...} }
//                                          ^ 正确的 webpack exports 别名
```

**怎么验**：解包 rpk，扫所有 `.js`：

```python
import zipfile, re
z = zipfile.ZipFile("xxx.rpk")
for n in z.namelist():
    if n.endswith(".js"):
        s = z.read(n).decode("utf-8", "ignore")
        c = len(re.findall(r"(?<![.\w$])exports\s*[.=]", s))   # 排除 x.exports / t.exports
        if c: print(n, c)
```

**必须是 0**。正常项目 0 处；中招的项目会有几百处（本框架曾经是 261 处：
app.js 2 / index 92 / chat 68 / inbox 65 / settings 31 / about 4）。

**为什么 `npm test` 不受影响**：`tools/*.mjs` 是 `.mjs` 后缀，Node 天然按 ESM 处理，
不依赖 `"type"`。所以这一行纯属多余，删掉即可。

**这个坑藏了很久的原因**：源码完全正确，模拟运行也全过，只有编译产物是坏的 ——
而框架的包当时从没在真机上验证过。**以后改完 `package.json`，一定要真机装一次。**

---

## 23. 上一条的自检要跑**正式包**，调试包里那几百处是假警报

**症状**：按上一条的方法扫 `npm run build` 出来的调试包，满屏都是「中招」，以为 bug 又回来了。

**原因**：调试包（`NODE_PHASE=dev`）不做压缩，模块包装是
`function(module, exports, $app_require$){...}` —— **`exports` 是形参**，
`exports.default = ...` 完全合法。正式包（`prod`）压成 `(e,t)=>{...}`，
`exports` 才是那个不存在的全局变量。

所以自检必须拿 `packages/` 里的 **release 包**跑，或者至少看一眼命中的地方是不是在
`(module, exports, ...)` 这种包装里。

```python
sig = re.search(rb"\(module,\s*exports", content)   # 调试包特征，有就别数了
```

---

## 24. 立绘模式别混用 `onclick` / `onlongpress` 和 `ontouchstart`

**症状**：立绘模式里点一下不说话、或者长按不弹按钮（取决于哪套事件被吃掉）。

**原因**：同一个节点上既有原始触摸事件、又有手势事件时，Vela 的行为不稳定 ——
触摸序列被 `ontouchstart` 接管后，`onclick` 的识别可能就不触发了。

**做法**：立绘那层只挂 `ontouchstart / ontouchmove / ontouchend`，**三个都不挂手势**，
自己在抬手时判：

```js
onDragEnd() {
  const dt = new Date().getTime() - this.dragT0
  if (this.dragMoved) return this.saveViewState()   // 拖过 = 只存位置
  if (dt >= 500) return this.onLongPress()          // 按住 ≥ 0.5s = 长按
  this.onTap()                                      // 否则 = 点击
}
```

顺带：`e.touches[0].clientX / clientY` 是**物理 px**，要乘 `k = 480/sw` 才能和
设计 px 的坐标比。chat 页翻页也是这么做的。

---

## 25. 用 PIL 画预览图时，`ImageDraw` 不做 alpha 混合

**症状**：预览图里半透明面板、按钮底全部变成**纯白**，和实机完全不一样。

**原因**：`ImageDraw.Draw(im, "RGBA")` 画 RGBA 颜色时是**直接替换像素**（不是叠加），
存成 RGB 时 alpha 一丢，`rgba(255,255,255,0.07)` 就变成了纯白。

**做法**：半透明的东西先画到一张全透明图层，再 `im.alpha_composite(layer)`：

```python
layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
ImageDraw.Draw(layer).rounded_rectangle(box, radius=r, fill=(0, 0, 0, 158))
im.alpha_composite(layer)
```

`tools/preview_index.py` 里的 `Canvas.rrect()` 就是这么写的。

## 26. 想「打包时排除某个素材目录」，不能把它改名到 `src/` 里面

`aiot build` 打的是整个 `src/` 目录，**不认任何排除规则**。想把某个机型用不到的
素材剔出去（比如手环 10 不支持立绘，4 张 440KB 的立绘不该进包），只能临时把目录
移出 `src/`：

```python
# ✅ 正确
TACHIE_PARK = os.path.join(ROOT, "_tachie_parked")        # 在 src 外面
# ❌ 错误 —— 挪到 src/common/_tachie_parked 照样被打进包
TACHIE_PARK = os.path.join(ROOT, "src", "common", "_tachie_parked")
```

踩坑现场：改完包体积一个字节没变（2113 KB → 2113 KB），解包才发现
`common/_tachie_parked/` 整整齐齐躺在里面。

配套两件事，缺一个就会出事：
- 挪走/还原要包在 `try / finally` 里，构建失败也必须还原，否则源码树少一个目录
- `main()` 开头先跑一次还原，兜住「上次打包被强杀」留下的现场

## 27. 绝对定位的全屏层要放在 `.page` 的**第一个**子节点

立绘层 `.tlayer` 是 `position:absolute` 铺满画布的。它一旦排在顶栏后面，
就会盖在顶栏上面 —— 立绘模式长按浮出顶栏后，消息按钮看得见但**点不动**
（透明层照样吃触摸，因为它自己挂着 `ontouchstart`）。

规则：**铺满屏幕的透明层放最前，交互面板放最后**。这样绘制顺序是
「立绘 → 顶栏 → 底栏 → 调整面板」，每一层都能点到。

同一个道理也适用于 `.bottombar-abs`：它必须排在 `.tlayer` 之后。

## 28. 触发池的「兜底」会把声明过 `slots: []` 的剧情也挑出来

旧版 `maybeTrigger` 挑剧情是三层兜底：

```js
if (!pool.length) pool = avail.filter(s => !s.dates)
if (!pool.length) pool = avail          // ← 这一层
```

最后那层「实在没有就用全部」很贴心，但它让 `CUSTOMIZE.md` 里那句
「`slots: []` + 没有 `dates` = 永远不会自动触发」变成了假话 —— 只要当天
没有别的可触发剧情，终章彩蛋（`slots: []`）就会被这层兜底选中，提前冒出来。

修法是在分池之前显式挡掉，别指望兜底：

```js
function neverAuto(s) {
  return !!(s.slots && !s.slots.length && !(s.dates && s.dates.length))
}
// 循环里：
if (neverAuto(s)) continue
```

同一个坑还有个变体：**彩蛋判断必须排在「每日额度」检查之前**。
彩蛋是通关奖励，如果先判 `count >= DAILY_CAP` 就直接 return，满好感那天
可能一条都冒不出来，玩家会以为机制坏了。

## 29. 改成概率触发之后，冒烟测试不能再写「调一次必定冒一条」

`maybeTrigger` 从「每天一条」改成「1 / 可触发数」之后，测试里原来的

```js
const t = await trigger()
eq('...', t, 'sample_slot')      // ✗ 一半概率是 null
```

会随机挂。而且不是「偶发」，是**五成概率**挂 —— 这种测试比没有还糟，
会让人误以为是实现坏了。

正确写法是「反复判定直到冒出来」，因为不触发时 `maybeTrigger` 不改状态
（只可能在跨天时落一次盘），重试是安全的：

```js
async function triggerUntil(max) {
  for (let i = 0; i < (max || 800); i++) {
    const id = await trigger()
    if (id) return id
  }
  return null
}
```

要断言「额度用完后不再冒」这种**否定**性质，反过来写：连续判定几百次，
统计结果里不该出现普通剧情（`minAff === 0` 的那些）。
单次调用证明不了任何事。

## 30. 长按别在抬手时才判「按了多久」

立绘模式不用 `onlongpress`（会跟 `ontouchstart` 互相吞，见第 24 条），
长按只能自己在触摸事件里判。第一版图省事，在 `ontouchend` 里算
`now - t0 >= 500` —— 逻辑上没错，手感是坏的：**按住半秒还得把手指抬起来才有反应**，
用户会觉得「按了没反应，一松手才动」。

正确做法是 `ontouchstart` 里直接挂定时器，到点就触发，不等抬手：

```js
onDragStart(e) {
  this.dragOn = true
  this.dragMoved = false
  this.longFired = false
  this.clearLong()
  const self = this
  this.longTimer = setTimeout(function () {
    self.longTimer = 0
    if (!self.dragOn || self.dragMoved) return   // 已经抬手 / 已经在拖了
    self.longFired = true
    self.onLongPress()
  }, 500)
}
```

三件事必须配套，少一个就出 bug：

1. **手指移动要撤销定时器** —— 否则「想滑一下」也会被判成长按。
   非拖动模式下也要处理，容差给 12 设计 px（手抖通常不超过这个）。
2. **触发过之后抬手不能再当成点击** —— 用 `longFired` 挡住 `onTap()`，
   否则顶栏浮出的同一瞬间又冒一句台词。这个 bug 很隐蔽：只在「长按」这一种路径上出现。
3. **`onHide` / `onDestroy` 里清定时器** —— 页面切走之后回调还在跑，
   改的是已销毁页面的 data。

另外调整模式（拖动立绘）里**不要挂**这个定时器：手指本来就要按住拖，
长按没有语义，挂了反而会在拖到一半时突然切换顶栏。

## 31. 「让立绘活起来」不是让它一直动

第一版给立绘加的是**持续呼吸浮动**：正弦上下 ±6 设计 px，一个来回 3.6 秒。
想法是「角色在呼吸，更有生命感」。实机反馈是反的 —— 用户的原话是
「不是呼吸震动，而是立绘切换后快速震动一下」。

两个问题：

- **一直动会分心**。手表是戴在手腕上、抬起来看一眼的东西，画面持续位移
  会让人下意识去盯它。而且 3.6 秒一个来回的频率，看起来更像「画面在晃」，
  不像「角色在呼吸」（真人呼吸频率是 3~4 秒一次，但幅度小到几乎看不出来）。
- **成本是持续的**。60ms 一个 tick，每个 tick 都要判断、偶尔要写一次 style，
  只要页面活着就一直跑。而「换脸抖一下」只在用户真的点了之后跑 8 帧。

改成一次性反馈：

```js
// 触发点：只有差分 id 真的变了才抖
setExpr(name) {
  const id = diffIdFor(name)
  if (id !== this.tachieId) {
    this.tachieId = id
    this.tachieSrc = tachiePath(id)
    this.startShake()
  }
}

// 主循环：静止时一个 if 就过去了
if (this.shakeTick > 0 && !this.adjusting) {
  this.shakeTick--
  const decay = this.shakeTick / SHAKE_TICKS
  const sgn = (this.shakeTick % 2 === 0) ? 1 : -1
  this.shakeY = Math.round(sgn * (this.ch || 540) * SHAKE_AMP * decay)
  this.renderTachie()
} else if (this.shakeY !== 0) {
  this.shakeTick = 0
  this.shakeY = 0
  this.renderTachie()
}
```

三个细节：

- **衰减要乘在幅度上，不是乘在频率上**。`decay = 剩余帧/总帧` 线性衰减，
  最后一帧正好是 0，不用额外收尾。
- **`shakeTick % 2` 决定方向**，上下交替。别用 `Math.sin(phase)` ——
  8 帧只够跑 1.5 个来回，正弦取样点太少，看起来会像「跳了一下」而不是「抖」。
- **调整面板打开时必须归位**（`else if (shakeY !== 0)` 分支），
  否则抖到一半打开面板，立绘停在偏移位置上，拖起来对不准。

## 32. 素材画质和体积上限：9MB 是新的红线

早期文档里写过「rpk 必须 < 300KB」，那是 GIF 表情包时代的社区经验值，
从来没有官方依据。主项目 `luotianyi-pet` 的正式包 1685 KB 在四个机型上
跑了半年没出过问题 —— 这条线可以放掉。

现在的实际标准是 **9MB**。所以立绘素材不必再压：

| | 之前 | 现在 |
|---|---|---|
| 天依 4 张 | 654×960 / 48 色 / 440 KB | 872×1280 / 全彩 / 2121 KB |
| Z14 8 张 | 654×752 / 48 色 / 542 KB | 1024×1178 / 原分辨率全彩 / 6097 KB |

**48 色量化在 2D 插画上会出色带**，尤其是皮肤渐变和浅色衣服，放大到 2 倍以上
一片一片的。3D 渲染（天依那几张）问题小一些，但也没必要为省 1.6MB 换画质。

体积变大之后仍然要守的两条：
- **手环 10 不打包立绘**（`park_tachie()` 把目录挪到 `src/` 外面），否则白多 2MB
- **包体积增长要跟解码内存一起看**。1024×1178 的 PNG 解码后是 4.6MB RGBA，
  8 张不同时显示、但图片缓存可能留住几张。真要出内存问题，先降分辨率再降色深。
