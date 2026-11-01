# -*- coding: utf-8 -*-
"""
生成「高斯模糊光斑」素材（tools/gen_glow.py）

Vela 不支持 backdrop-filter，也不支持 linear-gradient，
所以「黑色高斯模糊」只能把模糊效果**预先烘进 PNG**：

  · 一张 256px 的径向柔光图（中心亮、边缘完全透明，alpha 按高斯曲线衰减）
  · 页面里用 <image> 放大 + opacity 调暗，叠在纯黑底上
  · 上层再盖 rgba(255,255,255,0.06) 的黑色玻璃面板 → 就是毛玻璃观感
  · 零运行时开销（不用 filter: blur()，不重绘），比运行时模糊稳

★ 不要 quantize！RGB 恒定、只有 alpha 渐变，调色板会把 alpha 量化成十几级，
  出现一圈圈色阶，而且 alpha=0 的边缘会被吃掉（露出一个方形底）。
  直出 RGBA 只有 11KB，完全值得。

用法：python tools/gen_glow.py
产物：src/common/img/glow.png
"""
import os
import math
from PIL import Image

SIZE = 256
RGB = (160, 168, 182)      # 冷灰（几乎无彩度），压在纯黑上不刺眼
FALLOFF = 1.85             # 越大越"收"，边缘越快归零
PEAK = 0.85                # 中心最大不透明度

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "src", "common", "img", "glow.png")


def main():
    c = (SIZE - 1) / 2.0
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    px = im.load()
    for y in range(SIZE):
        dy = (y - c) / c
        for x in range(SIZE):
            dx = (x - c) / c
            d = math.sqrt(dx * dx + dy * dy)
            a = min(1.0, math.exp(-(d * FALLOFF) ** 2) * PEAK)
            px[x, y] = (RGB[0], RGB[1], RGB[2], int(round(a * 255)))

    im.save(OUT, optimize=True)
    print("glow.png %dpx %.1f KB" % (SIZE, os.path.getsize(OUT) / 1024.0))


if __name__ == "__main__":
    main()
