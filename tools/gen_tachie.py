# -*- coding: utf-8 -*-
"""生成立绘占位图（4 张表情差分）。

框架不带美术素材，这四张只是「能跑起来、能看出差分」的占位：
浅灰剪影 + 简笔五官，纯透明底，和表情占位图是同一套思路。

换成自己的立绘：直接覆盖 src/common/tachie/*.png 即可，
尺寸可以不同（页面用 object-fit: contain 按容器等比缩放），
但**同一个角色的几张请用同一画布尺寸**，否则差分切换时会「跳」。

用法：python tools/gen_tachie.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "common", "tachie")

W, H = 420, 620
S = 3                       # 超采样倍数

SKIN = (214, 216, 226, 255)
HAIR = (92, 96, 110, 255)
DARK = (38, 40, 48, 255)
BLUSH = (255, 138, 148, 190)
TEAR = (120, 200, 255, 220)


def canvas():
    return Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))


def s(v):
    return int(round(v * S))


def body(d):
    """肩 + 躯干：一个上窄下宽的圆角梯形，画到画布底边"""
    top, bot = 438, H
    tw, bw = 92, 172
    cx = W / 2.0
    pts = [
        (cx - tw, top), (cx + tw, top),
        (cx + bw, bot), (cx - bw, bot)
    ]
    d.polygon([(s(x), s(y)) for x, y in pts], fill=SKIN)
    # 肩线：一条横向的圆角条，把梯形顶边磨圆（不画成两个球，会像瘤子）
    d.rounded_rectangle([s(cx - tw), s(top - 22), s(cx + tw), s(top + 22)],
                        radius=s(22), fill=SKIN)
    # 脖子
    d.rectangle([s(cx - 32), s(360), s(cx + 32), s(456)], fill=SKIN)


def head(d):
    cx, cy, r = W / 2.0, 250, 132
    d.ellipse([s(cx - r), s(cy - r), s(cx + r), s(cy + r)], fill=SKIN)
    # 头发：盖住上半部分的一个大弧
    d.chord([s(cx - r - 6), s(cy - r - 10), s(cx + r + 6), s(cy + r - 30)],
            180, 360, fill=HAIR)
    # 两缕鬓角
    for dx in (-1, 1):
        x = cx + dx * (r - 10)
        d.ellipse([s(x - 30), s(cy - 60), s(x + 30), s(cy + 90)], fill=HAIR)
    return cx, cy


def face_normal(d, cx, cy):
    for dx in (-46, 46):
        d.ellipse([s(cx + dx - 13), s(cy - 6), s(cx + dx + 13), s(cy + 26)], fill=DARK)
    d.line([s(cx - 18), s(cy + 66), s(cx + 18), s(cy + 66)], fill=DARK, width=s(7))


def face_smile(d, cx, cy):
    # 弯眼
    for dx in (-46, 46):
        d.arc([s(cx + dx - 22), s(cy - 16), s(cx + dx + 22), s(cy + 26)],
              200, 340, fill=DARK, width=s(8))
    # 笑嘴
    d.arc([s(cx - 34), s(cy + 34), s(cx + 34), s(cy + 92)],
          10, 170, fill=DARK, width=s(8))


def face_shy(d, cx, cy):
    # 闭眼（两条短横）
    for dx in (-46, 46):
        d.line([s(cx + dx - 18), s(cy + 10), s(cx + dx + 18), s(cy + 10)],
               fill=DARK, width=s(8))
    # 腮红
    for dx in (-84, 84):
        d.ellipse([s(cx + dx - 26), s(cy + 30), s(cx + dx + 26), s(cy + 58)], fill=BLUSH)
    # 小嘴
    d.ellipse([s(cx - 11), s(cy + 56), s(cx + 11), s(cy + 76)], fill=DARK)


def face_sad(d, cx, cy):
    for dx in (-46, 46):
        d.ellipse([s(cx + dx - 12), s(cy), s(cx + dx + 12), s(cy + 28)], fill=DARK)
    # 下垂的嘴
    d.arc([s(cx - 32), s(cy + 62), s(cx + 32), s(cy + 106)],
          190, 350, fill=DARK, width=s(8))
    # 一滴眼泪
    d.ellipse([s(cx + 52), s(cy + 40), s(cx + 68), s(cy + 66)], fill=TEAR)


FACES = {
    "normal": face_normal,
    "smile": face_smile,
    "shy": face_shy,
    "sad": face_sad,
}


def build(name):
    im = canvas()
    d = ImageDraw.Draw(im)
    body(d)
    cx, cy = head(d)
    FACES[name](d, cx, cy)
    im = im.resize((W, H), Image.LANCZOS)
    # 只有几个纯色块，量化到 48 色能把体积砍一半而看不出差别（仍是 RGBA，不用调色板模式）
    im = im.quantize(colors=48, method=Image.FASTOCTREE).convert("RGBA")
    im.save(os.path.join(OUT, name + ".png"), optimize=True)


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    total = 0
    for name in FACES:
        build(name)
        p = os.path.join(OUT, name + ".png")
        total += os.path.getsize(p)
        print("  %-8s %5.1f KB" % (name + ".png", os.path.getsize(p) / 1024.0))
    print("合计 %.1f KB（%dx%d，RGBA）" % (total / 1024.0, W, H))


if __name__ == "__main__":
    main()
