# -*- coding: utf-8 -*-
"""生成界面图标与应用图标（PNG，带 alpha，4 倍超采样抗锯齿）"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "src", "common", "img")
S = 4
BLUE = (102, 204, 255, 255)
WHITE = (232, 246, 255, 255)


def canvas(n):
    return Image.new("RGBA", (n * S, n * S), (0, 0, 0, 0))


def save(im, name, n):
    im.resize((n, n), Image.LANCZOS).save(os.path.join(IMG, name), optimize=True)


def rounded_line(d, p0, p1, w, fill):
    d.line([p0, p1], fill=fill, width=int(w))
    r = w / 2.0
    for p in (p0, p1):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=fill)


def icon_exit():
    n = 96
    im = canvas(n)
    d = ImageDraw.Draw(im)
    m = 30 * S
    e = n * S - m
    w = 9 * S
    rounded_line(d, (m, m), (e, e), w, WHITE)
    rounded_line(d, (e, m), (m, e), w, WHITE)
    save(im, "ic_exit.png", n)


def icon_back():
    n = 96
    im = canvas(n)
    d = ImageDraw.Draw(im)
    w = 9 * S
    cx, cy = 56 * S, 48 * S
    rounded_line(d, (cx, cy - 22 * S), (cx - 22 * S, cy), w, WHITE)
    rounded_line(d, (cx - 22 * S, cy), (cx, cy + 22 * S), w, WHITE)
    save(im, "ic_back.png", n)


def icon_set():
    n = 96
    im = canvas(n)
    d = ImageDraw.Draw(im)
    w = 7 * S
    for i, (y, knob) in enumerate([(30, 60), (48, 36), (66, 54)]):
        y = y * S
        rounded_line(d, (26 * S, y), (70 * S, y), w, (150, 205, 235, 235))
        r = 7.5 * S
        cx = knob * S
        d.ellipse([cx - r, y - r, cx + r, y + r], fill=WHITE)
    save(im, "ic_set.png", n)


def icon_app():
    """应用图标：和占位表情同款的简笔笑脸（换成自己的美术时直接覆盖 icon.png）

    底是**正圆**不是圆角矩形 —— 手表桌面图标位是圆形遮罩，方角会被切掉。
    内圈按「脸 46 + 三道环 57/65/75」排，最外环占圆底 78%，留 21% 边距；
    这个比例是从原来的圆角矩形版等比缩下来的（脸 52 / 环 64·74·84），只缩小不改形。
    """
    n = 192
    im = canvas(n)
    d = ImageDraw.Draw(im)
    # 圆形底
    d.ellipse([0, 0, n * S - 1, n * S - 1], fill=(9, 20, 31, 255))
    # 光晕环
    for rr, a in [(75, 20), (65, 34), (57, 50)]:
        r = rr * S
        c = n * S / 2.0
        d.ellipse([c - r, c - r, c + r, c + r], outline=(102, 204, 255, a), width=int(2 * S))
    # 脸
    c = n * S / 2.0
    fr = 46 * S
    d.ellipse([c - fr, c - fr, c + fr, c + fr], fill=(242, 244, 247, 255))
    # 弯眼睛
    ew, eh = 10 * S, 8 * S
    for dx in (-14 * S, 14 * S):
        d.arc([c + dx - ew, c - 11 * S - eh, c + dx + ew, c - 11 * S + eh],
              200, 340, fill=(43, 47, 54, 255), width=int(3 * S))
    # 笑嘴
    mw, mh = 16 * S, 12.5 * S
    d.arc([c - mw, c + 2 * S - mh, c + mw, c + 2 * S + mh],
          20, 160, fill=(43, 47, 54, 255), width=int(3 * S))
    small = im.resize((n, n), Image.LANCZOS)
    small.quantize(colors=32, method=Image.FASTOCTREE).save(
        os.path.join(IMG, "icon.png"), optimize=True)


def icon_swap():
    """切换（立绘 ↔ 表情包）：上下两条反向箭头，中间留一道缝"""
    n = 96
    im = canvas(n)
    d = ImageDraw.Draw(im)
    w = 8 * S
    # 上箭头：从左到右
    y1 = 34 * S
    rounded_line(d, (26 * S, y1), (66 * S, y1), w, WHITE)
    rounded_line(d, (66 * S, y1), (54 * S, y1 - 12 * S), w, WHITE)
    rounded_line(d, (66 * S, y1), (54 * S, y1 + 12 * S), w, WHITE)
    # 下箭头：从右到左
    y2 = 62 * S
    rounded_line(d, (70 * S, y2), (30 * S, y2), w, (150, 205, 235, 235))
    rounded_line(d, (30 * S, y2), (42 * S, y2 - 12 * S), w, (150, 205, 235, 235))
    rounded_line(d, (30 * S, y2), (42 * S, y2 + 12 * S), w, (150, 205, 235, 235))
    save(im, "ic_swap.png", n)


def icon_adjust():
    """调整（移动 + 缩放）：十字四向箭头"""
    n = 96
    im = canvas(n)
    d = ImageDraw.Draw(im)
    w = 7 * S
    c = 48 * S
    a = 22 * S        # 臂长
    h = 9 * S         # 箭头半宽
    # 十字
    rounded_line(d, (c - a, c), (c + a, c), w, WHITE)
    rounded_line(d, (c, c - a), (c, c + a), w, WHITE)
    # 四个箭头
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        tipx, tipy = c + dx * (a + 8 * S), c + dy * (a + 8 * S)
        bx, by = c + dx * a, c + dy * a
        px, py = -dy, dx
        d.polygon([
            (tipx, tipy),
            (bx + px * h, by + py * h),
            (bx - px * h, by - py * h)
        ], fill=WHITE)
    save(im, "ic_adjust.png", n)


if __name__ == "__main__":
    os.makedirs(IMG, exist_ok=True)
    icon_exit()
    icon_back()
    icon_set()
    icon_swap()
    icon_adjust()
    icon_app()
    for f in sorted(os.listdir(IMG)):
        print(f, "%.1fKB" % (os.path.getsize(os.path.join(IMG, f)) / 1024.0))
