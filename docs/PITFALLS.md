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
