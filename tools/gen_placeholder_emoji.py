#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 12 套**占位表情图**（框架自带，供没素材时先跑起来）

    python tools/gen_placeholder_emoji.py

输出：src/common/emoji/<name>_0.png  208×208 透明底，24 色量化

这些图只是「能跑」用的占位，正式发布请换成自己的美术素材：
把同名文件覆盖掉即可，代码不用改。想加帧就放 <name>_1.png ...
再到 config/emoji.js 的 FRAMES 里登记帧数。

设计约束（跟着框架的显示逻辑走）：
  · 正方形 208×208 —— 页面用 object-fit: contain，任意比例都不变形，
    这里选正方形只是为了各机型缩放下视觉重量一致
  · 透明底 —— 叠在黑色毛玻璃上，白底会露一块方框
  · 深色五官 + 浅色脸 —— 深色背景下对比够
"""
import os
from PIL import Image, ImageDraw

SIZE = 208
SS = 4                     # 超采样倍数，画完缩回去，边缘才不毛糙
S = SIZE * SS

FACE = (242, 244, 247, 255)     # 脸（近白）
INK = (43, 47, 54, 255)         # 五官（近黑）
BLUSH = (255, 158, 170, 200)    # 腮红
ACCENT = (102, 204, 255, 255)   # 强调色（和 theme.js 的 accent 一致）

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'src', 'common', 'emoji')


def new_canvas():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def face_base(d):
    """画脸：一个大圆，留 6% 边距"""
    m = int(S * 0.06)
    d.ellipse([m, m, S - m, S - m], fill=FACE)


def dot_eye(d, cx, cy, r=None):
    r = r or int(S * 0.055)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)


def arc_eye(d, cx, cy, w=None, up=True):
    """弯弯的眼睛（^ ^ 或 u u）"""
    w = w or int(S * 0.075)
    h = int(w * 0.75)
    box = [cx - w, cy - h, cx + w, cy + h]
    if up:
        d.arc(box, 200, 340, fill=INK, width=int(S * 0.028))
    else:
        d.arc(box, 20, 160, fill=INK, width=int(S * 0.028))


def line_eye(d, cx, cy, w=None):
    w = w or int(S * 0.07)
    d.line([cx - w, cy, cx + w, cy], fill=INK, width=int(S * 0.026))


def mouth_smile(d, cy, w=None, lw=None):
    w = w or int(S * 0.11)
    h = int(w * 0.8)
    d.arc([S // 2 - w, cy - h, S // 2 + w, cy + h], 20, 160,
          fill=INK, width=lw or int(S * 0.028))


def mouth_frown(d, cy, w=None):
    w = w or int(S * 0.10)
    h = int(w * 0.8)
    d.arc([S // 2 - w, cy - h, S // 2 + w, cy + h], 200, 340,
          fill=INK, width=int(S * 0.028))


def mouth_flat(d, cy, w=None):
    w = w or int(S * 0.075)
    d.line([S // 2 - w, cy, S // 2 + w, cy], fill=INK, width=int(S * 0.028))


def mouth_open(d, cy, r=None):
    r = r or int(S * 0.055)
    d.ellipse([S // 2 - r, cy - r, S // 2 + r, cy + r], fill=INK)


def brow(d, cx, cy, w=None, tilt=1):
    """眉毛，tilt=1 内高外低（生气），tilt=-1 内低外高（难过）"""
    w = w or int(S * 0.075)
    h = int(S * 0.035) * tilt
    d.line([cx - w, cy - h, cx + w, cy + h], fill=INK, width=int(S * 0.024))


def heart(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx, cy], fill=INK)
    d.ellipse([cx, cy - r, cx + r, cy], fill=INK)
    d.polygon([(cx - r, cy - r * 0.25), (cx + r, cy - r * 0.25), (cx, cy + r)], fill=INK)


def sparkle(d, cx, cy, r, color=ACCENT):
    d.polygon([(cx, cy - r), (cx + r * 0.28, cy - r * 0.28), (cx + r, cy),
               (cx + r * 0.28, cy + r * 0.28), (cx, cy + r),
               (cx - r * 0.28, cy + r * 0.28), (cx - r, cy),
               (cx - r * 0.28, cy - r * 0.28)], fill=color)


def draw_idle(d):
    face_base(d)
    dot_eye(d, S // 2 - int(S * 0.14), S // 2 - int(S * 0.05))
    dot_eye(d, S // 2 + int(S * 0.14), S // 2 - int(S * 0.05))
    mouth_flat(d, S // 2 + int(S * 0.15))


def draw_happy(d):
    face_base(d)
    arc_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.05), up=True)
    arc_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.05), up=True)
    mouth_smile(d, S // 2 + int(S * 0.10), w=int(S * 0.13))


def draw_shy(d):
    face_base(d)
    arc_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.03), up=True)
    arc_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.03), up=True)
    # 腮红
    r = int(S * 0.055)
    for cx in (S // 2 - int(S * 0.24), S // 2 + int(S * 0.24)):
        d.ellipse([cx - r, S // 2 + int(S * 0.10) - r * 0.6,
                   cx + r, S // 2 + int(S * 0.10) + r * 0.6], fill=BLUSH)
    mouth_smile(d, S // 2 + int(S * 0.13), w=int(S * 0.07))


def draw_sad(d):
    face_base(d)
    brow(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.17), tilt=-1)
    brow(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.17), tilt=1)
    dot_eye(d, S // 2 - int(S * 0.14), S // 2 - int(S * 0.02), int(S * 0.045))
    dot_eye(d, S // 2 + int(S * 0.14), S // 2 - int(S * 0.02), int(S * 0.045))
    mouth_frown(d, S // 2 + int(S * 0.19))


def draw_angry(d):
    face_base(d)
    brow(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.18), tilt=1)
    brow(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.18), tilt=-1)
    dot_eye(d, S // 2 - int(S * 0.14), S // 2 - int(S * 0.01), int(S * 0.045))
    dot_eye(d, S // 2 + int(S * 0.14), S // 2 - int(S * 0.01), int(S * 0.045))
    mouth_flat(d, S // 2 + int(S * 0.18), w=int(S * 0.085))
    # 额头上的怒气符号
    cx, cy, r = S // 2, int(S * 0.22), int(S * 0.05)
    d.line([cx - r, cy - r * 0.4, cx - r * 0.2, cy + r * 0.4], fill=ACCENT, width=int(S * 0.018))
    d.line([cx + r, cy - r * 0.4, cx + r * 0.2, cy + r * 0.4], fill=ACCENT, width=int(S * 0.018))


def draw_think(d):
    face_base(d)
    dot_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.05), int(S * 0.05))
    line_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.05), int(S * 0.06))
    # 嘴：偏小的扁椭圆，比圆点更像「唔……」
    mw, mh = int(S * 0.045), int(S * 0.026)
    d.ellipse([S // 2 - mw, S // 2 + int(S * 0.14) - mh,
               S // 2 + mw, S // 2 + int(S * 0.14) + mh], fill=INK)
    # 右上角三个渐大的点（全部落在脸内，别贴边）
    for i, (fx, fy) in enumerate(((0.60, 0.34), (0.67, 0.28), (0.74, 0.22))):
        r = int(S * 0.016) + i * int(S * 0.004)
        cx, cy = int(S * fx), int(S * fy)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT)


def draw_cheer(d):
    face_base(d)
    arc_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.05), up=True)
    arc_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.05), up=True)
    mouth_smile(d, S // 2 + int(S * 0.08), w=int(S * 0.14))
    sparkle(d, int(S * 0.76), int(S * 0.26), int(S * 0.070))
    sparkle(d, int(S * 0.84), int(S * 0.37), int(S * 0.042))


def draw_eat(d):
    face_base(d)
    arc_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.08), up=True)
    arc_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.08), up=True)
    mouth_open(d, S // 2 + int(S * 0.13), int(S * 0.062))
    # 一只小碗
    r = int(S * 0.09)
    cy = int(S * 0.70)
    d.arc([S // 2 - r, cy - r, S // 2 + r, cy + r],
          0, 180, fill=ACCENT, width=int(S * 0.024))


def draw_sing(d):
    face_base(d)
    arc_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.06), up=True)
    arc_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.06), up=True)
    # 张嘴唱
    r = int(S * 0.055)
    d.ellipse([S // 2 - r, S // 2 + int(S * 0.06) - r, S // 2 + r, S // 2 + int(S * 0.06) + r], fill=INK)
    # 音符
    cx, cy = int(S * 0.70), int(S * 0.33)
    rr = int(S * 0.038)
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=ACCENT)
    d.line([cx + rr, cy, cx + rr, cy - int(S * 0.11)], fill=ACCENT, width=int(S * 0.016))


def draw_surprise(d):
    face_base(d)
    dot_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.06), int(S * 0.065))
    dot_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.06), int(S * 0.065))
    mouth_open(d, S // 2 + int(S * 0.16), int(S * 0.045))


def draw_sleep(d):
    face_base(d)
    arc_eye(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.04), up=False)
    arc_eye(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.04), up=False)
    mouth_open(d, S // 2 + int(S * 0.15), int(S * 0.032))
    # 睡眠符号
    for i, (cx, cy, r) in enumerate(((int(S * 0.68), int(S * 0.29), int(S * 0.050)),
                                     (int(S * 0.76), int(S * 0.38), int(S * 0.036)))):
        d.line([cx - r, cy - r * 0.6, cx + r, cy - r * 0.6], fill=ACCENT, width=int(S * 0.014))
        d.line([cx + r, cy - r * 0.6, cx - r, cy + r * 0.6], fill=ACCENT, width=int(S * 0.014))
        d.line([cx - r, cy + r * 0.6, cx + r, cy + r * 0.6], fill=ACCENT, width=int(S * 0.014))


def draw_love(d):
    face_base(d)
    r = int(S * 0.058)
    heart(d, S // 2 - int(S * 0.15), S // 2 - int(S * 0.06), r)
    heart(d, S // 2 + int(S * 0.15), S // 2 - int(S * 0.06), r)
    mouth_smile(d, S // 2 + int(S * 0.10), w=int(S * 0.11))


DRAW = {
    'idle': draw_idle,
    'happy': draw_happy,
    'shy': draw_shy,
    'sad': draw_sad,
    'angry': draw_angry,
    'think': draw_think,
    'cheer': draw_cheer,
    'eat': draw_eat,
    'sing': draw_sing,
    'surprise': draw_surprise,
    'sleep': draw_sleep,
    'love': draw_love,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, fn in DRAW.items():
        img = new_canvas()
        d = ImageDraw.Draw(img)
        fn(d)
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
        img = img.quantize(colors=24, method=Image.FASTOCTREE).convert('RGBA')
        path = os.path.join(OUT, name + '_0.png')
        img.save(path, optimize=True)
        sz = os.path.getsize(path)
        total += sz
        print('  %-9s %6d B' % (name + '_0.png', sz))
    print('共 %d 张，%d B（%.1f KB）' % (len(DRAW), total, total / 1024.0))


if __name__ == '__main__':
    main()
