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
