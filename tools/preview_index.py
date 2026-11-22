# -*- coding: utf-8 -*-
"""按 index.ux 的真实几何，把主页画成 PNG 预览（只用来看比例，不是运行时截图）。

几何全部照抄 index.ux 的 applySizes / layoutTachie / layoutAdjust，
所以这里画出来是什么样，实机上就是什么样（字体除外）。

用法：python tools/preview_index.py [机型key]
      机型key: mb10 / mb10pro / rw56（默认 rw56）
产物：preview/index_<机型>_<状态>.png

★ 手环 10（212 宽）不支持立绘模式，只出表情包那一张。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "preview")
TACHIE_DIR = os.path.join(ROOT, "src", "common", "tachie")
IMG_DIR = os.path.join(ROOT, "src", "common", "img")

DW = 480
MODELS = {
    "mb10": (212, 520, 46),
    "mb10pro": (480, 336, 44),
    "rw56": (432, 514, 90),
}
SIZE_R, POS_X, POS_Y, ASPECT = 0.92, 0.5, 0.46, 872 / 1280
SIZE_MIN, SIZE_MAX = 0.30, 3.00
POS_LO, POS_HI = -0.5, 1.5
TACHIE_MIN_W = 280

FONT = None
for cand in [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf",
             r"C:\Windows\Fonts\Deng.ttf"]:
    if os.path.exists(cand):
        FONT = cand
        break


def font(px):
    if not FONT:
        return ImageFont.load_default()
    return ImageFont.truetype(FONT, max(8, int(round(px))))


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def clamp_offset(v, size, canvas):
    """和 index.ux 里的 clampOffset 完全一致：图比画布小时整张留在画布内，
    图比画布大时至少铺满不留空白。"""
    if size <= canvas:
        return clamp(v, 0, canvas - size)
    return clamp(v, canvas - size, 0)


def layout(sw, sh):
    k = DW / float(sw)
    cw, ch = DW, int(round(sh * k))
    can_tachie = sw >= TACHIE_MIN_W

    btn_phys = clamp(sw * 0.1, 40, 54)
    btn = int(round(btn_phys * k))
    fs = int(round(clamp(sw * 0.042, 12, 18) * k))
    pad = int(round(ch * 0.03))
    narrow = sw < 280
    aff_h = int(round(fs * 1.5))
    row_gap = int(round(fs * 0.3))
    top_h = (btn + row_gap + aff_h + pad * 2) if narrow else (btn + pad * 2)
    bot_h = btn + pad * 2
    gap = int(round(fs * 0.5))
    bubble_h = int(round(min(fs * 2.4, ch * 0.15)))
    stage_h = max(70, ch - top_h - bot_h - bubble_h - gap)
    em_ratio = 0.82 if sw < 280 else 0.5
    emoji = int(round(min(cw * em_ratio, stage_h * 0.92)))
    card = int(round(emoji * 1.08))
    bubble_w = cw - int(round(cw * 0.16))
    btn_gap = int(round(btn * 0.55))

    # 立绘底栏（绝对定位贴底，键做大一号）
    big = int(round(clamp(sw * 0.135, 48, 66) * k))
    big_ico = int(round(big * 0.52))
    big_gap = int(round(big * 0.55))
    tbar_h = big + pad * 2

    tb_w = int(round(cw * 0.74))
    tb_h = bubble_h
    tb_gap = int(round(ch * 0.02))
    tb_top = ch - tbar_h - tb_gap - tb_h

    # 调整面板
    a_pad = int(round(fs * 0.8))
    a_pad_b = max(a_pad, int(round(ch * 0.045)))
    a_tip = int(round(fs * 1.8))
    a_knob = int(round(fs * 2.2))
    a_slider = int(round(a_knob * 1.35))
    a_btn_h = max(int(round(fs * 3.0)), int(round(52 * k)))
    a_g = int(round(fs * 0.6))
    a_pan_h = a_pad + a_pad_b + a_tip + a_g + a_slider + a_g + a_btn_h
    a_track_w = int(round(cw * 0.78))
    a_track_h = max(5, int(round(fs * 0.7)))
    a_btn_w = int(round(cw * 0.34))
    a_btn_gap = int(round(fs * 0.9))

    return dict(k=k, cw=cw, ch=ch, btn=btn, fs=fs, pad=pad, narrow=narrow,
                can_tachie=can_tachie,
                aff_h=aff_h, row_gap=row_gap, top_h=top_h, bot_h=bot_h,
                gap=gap, bubble_h=bubble_h, stage_h=stage_h, emoji=emoji,
                card=card, bubble_w=bubble_w, btn_gap=btn_gap,
                big=big, big_ico=big_ico, big_gap=big_gap, tbar_h=tbar_h,
                tb_w=tb_w, tb_h=tb_h, tb_top=tb_top,
                a_pad=a_pad, a_pad_b=a_pad_b, a_tip=a_tip, a_knob=a_knob, a_slider=a_slider,
                a_btn_h=a_btn_h, a_g=a_g, a_pan_h=a_pan_h,
                a_track_w=a_track_w, a_track_h=a_track_h,
                a_btn_w=a_btn_w, a_btn_gap=a_btn_gap)


class Canvas(object):
    """把「设计 px」换算成物理 px 再画"""

    def __init__(self, sw, sh, k):
        self.sw, self.sh, self.k = sw, sh, k
        self.im = Image.new("RGBA", (sw, sh), (0, 0, 0, 255))
        self.d = ImageDraw.Draw(self.im, "RGBA")

    def s(self, v):
        return v / self.k          # 设计 px -> 物理 px

    def rrect(self, x, y, w, h, r, fill=None, outline=(255, 255, 255, 40), width=1):
        """PIL 的 ImageDraw 不做 alpha 混合（直接替换像素），
        所以半透明面板要先画到独立图层再合成，否则 convert('RGB') 时 alpha 一丢就变成纯白。"""
        x0, y0 = self.s(x), self.s(y)
        x1, y1 = self.s(x + w), self.s(y + h)
        layer = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle(
            [x0, y0, x1 - 1, y1 - 1], radius=self.s(r),
            fill=fill, outline=outline, width=width)
        self.im.alpha_composite(layer)

    def text(self, x, y, s, fs, color=(243, 243, 246, 255), anchor="mm"):
        self.d.text((self.s(x), self.s(y)), s, font=font(self.s(fs)),
                    fill=color, anchor=anchor)

    def icon(self, name, x, y, w, h):
        p = os.path.join(IMG_DIR, name)
        if not os.path.exists(p):
            return
        ic = Image.open(p).convert("RGBA").resize(
            (max(1, int(self.s(w))), max(1, int(self.s(h)))), Image.LANCZOS)
        self.im.alpha_composite(ic, (int(self.s(x)), int(self.s(y))))


def draw_btn(c, L, x, y, icon, d=None):
    d = d or L["btn"]
    c.rrect(x, y, d, d, d / 2.0, fill=(255, 255, 255, 18))
    ic = d * 0.52
    c.icon(icon, x + (d - ic) / 2.0, y + (d - ic) / 2.0, ic, ic)


def draw_topbar(c, L, tachie=False):
    pad = L["pad"]
    if tachie:      # 立绘模式：顶栏底衬
        c.rrect(0, 0, L["cw"], L["top_h"], 0, fill=(0, 0, 0, 158), outline=None)
    if L["narrow"]:
        bx = (L["cw"] - L["btn"]) / 2.0
        draw_btn(c, L, bx, pad, "ic_msg.png")
        ry = pad + L["btn"] + L["row_gap"]
        c.text(L["cw"] / 2.0 - 46, ry + L["aff_h"] / 2.0, "20:36", L["fs"] * 1.15)
        c.rrect(L["cw"] / 2.0 + 6, ry, L["fs"] * 4.2, L["aff_h"], L["aff_h"] / 2.0,
                fill=(255, 255, 255, 13))
        c.text(L["cw"] / 2.0 + 6 + L["fs"] * 2.1, ry + L["aff_h"] / 2.0,
               "Lv.1 12", L["fs"] * 0.72)
    else:
        clock_w = 5 * 0.56 * L["fs"] * 1.15
        aff_w = L["fs"] * 4.2
        g = L["fs"] * 0.7
        gw = L["btn"] + g + clock_w + g + aff_w
        gx = (L["cw"] - gw) / 2.0
        draw_btn(c, L, gx, pad, "ic_msg.png")
        c.text(gx + L["btn"] + g + clock_w / 2.0, pad + L["btn"] / 2.0,
               "20:36", L["fs"] * 1.15)
        c.rrect(gx + L["btn"] + g + clock_w + g, pad + (L["btn"] - L["aff_h"]) / 2.0,
                aff_w, L["aff_h"], L["aff_h"] / 2.0, fill=(255, 255, 255, 13))
        c.text(gx + L["btn"] + g + clock_w + g + aff_w / 2.0, pad + L["btn"] / 2.0,
               "Lv.1 12", L["fs"] * 0.72)


def draw_bottombar_emoji(c, L):
    """表情包底栏：支持立绘的机型是 [切换][设置]，手环 10 只有 [设置]"""
    icons = (["ic_swap.png"] if L["can_tachie"] else []) + ["ic_set.png"]
    n = len(icons)
    gw = n * L["btn"] + (n - 1) * L["btn_gap"]
    gx = (L["cw"] - gw) / 2.0
    by = L["ch"] - L["bot_h"] + L["pad"]
    for i, ic in enumerate(icons):
        draw_btn(c, L, gx + i * (L["btn"] + L["btn_gap"]), by, ic)


def draw_bottombar_tachie(c, L):
    """立绘底栏：绝对定位贴底 + 深色底衬 + 三个大键"""
    c.rrect(0, L["ch"] - L["tbar_h"], L["cw"], L["tbar_h"], 0,
            fill=(0, 0, 0, 158), outline=None)
    icons = ["ic_swap.png", "ic_adjust.png", "ic_set.png"]
    gw = 3 * L["big"] + 2 * L["big_gap"]
    gx = (L["cw"] - gw) / 2.0
    by = L["ch"] - L["tbar_h"] + L["pad"]
    for i, ic in enumerate(icons):
        draw_btn(c, L, gx + i * (L["big"] + L["big_gap"]), by, ic, L["big"])


def draw_tachie(c, L, name, size_r=SIZE_R, px=POS_X, py=POS_Y):
    h = int(round(L["ch"] * size_r))
    w = int(round(h * ASPECT))
    lx = clamp_offset(px * L["cw"] - w / 2.0, w, L["cw"])
    ty = clamp_offset(py * L["ch"] - h / 2.0, h, L["ch"])
    p = os.path.join(TACHIE_DIR, name + ".png")
    im = Image.open(p).convert("RGBA").resize(
        (max(1, int(c.s(w))), max(1, int(c.s(h)))), Image.LANCZOS)
    c.im.alpha_composite(im, (int(c.s(lx)), int(c.s(ty))))


def draw_tbubble(c, L, txt):
    x = (L["cw"] - L["tb_w"]) / 2.0
    c.rrect(x, L["tb_top"], L["tb_w"], L["tb_h"], L["tb_h"] / 2.0,
            fill=(0, 0, 0, 174))
    c.text(x + L["fs"] * 0.9, L["tb_top"] + L["tb_h"] / 2.0, txt, L["fs"], anchor="lm")


def draw_apanel(c, L, size_r):
    top = L["ch"] - L["a_pan_h"]
    c.rrect(0, top, L["cw"], L["a_pan_h"], 0, fill=(16, 16, 20, 240))
    ty = top + L["a_pad"]
    c.text(L["cw"] / 2.0, ty + L["a_tip"] / 2.0, "拖动立绘调位置",
           L["fs"] * 0.82, color=(154, 154, 163, 255))
    sl_y = ty + L["a_tip"] + L["a_g"]
    track_y = sl_y + (L["a_slider"] - L["a_track_h"]) / 2.0
    left = (L["cw"] - L["a_track_w"]) / 2.0
    r = (size_r - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)
    c.rrect(left, track_y, L["a_track_w"], L["a_track_h"], L["a_track_h"] / 2.0,
            fill=(255, 255, 255, 36), outline=None)
    c.rrect(left, track_y, L["a_track_w"] * r, L["a_track_h"], L["a_track_h"] / 2.0,
            fill=(102, 204, 255, 255), outline=None)
    kn = L["a_knob"]
    kx = left + r * (L["a_track_w"] - kn)
    ky = sl_y + (L["a_slider"] - kn) / 2.0
    c.rrect(kx, ky, kn, kn, kn / 2.0, fill=(243, 243, 246, 255),
            outline=(255, 255, 255, 140))
    btns = [("复位", 0.07), ("完成", 0.16)]
    gw = 2 * L["a_btn_w"] + L["a_btn_gap"]
    gx = (L["cw"] - gw) / 2.0
    by = L["ch"] - L["a_pad_b"] - L["a_btn_h"]
    for i, (label, a) in enumerate(btns):
        c.rrect(gx + i * (L["a_btn_w"] + L["a_btn_gap"]), by, L["a_btn_w"],
                L["a_btn_h"], L["a_btn_h"] / 2.0, fill=(255, 255, 255, int(a * 255)))
        c.text(gx + i * (L["a_btn_w"] + L["a_btn_gap"]) + L["a_btn_w"] / 2.0,
               by + L["a_btn_h"] / 2.0, label, L["fs"] * 0.9)


def draw_emoji_mode(c, L):
    draw_topbar(c, L)
    card = L["card"]
    cx = (L["cw"] - card) / 2.0
    cy = L["top_h"] + (L["stage_h"] - card) / 2.0
    c.rrect(cx, cy, card, card, card * 0.32, fill=(255, 255, 255, 15))
    em = L["emoji"]
    p = os.path.join(ROOT, "src", "common", "emoji", "happy_0.png")
    ic = Image.open(p).convert("RGBA").resize(
        (max(1, int(c.s(em))), max(1, int(c.s(em)))), Image.LANCZOS)
    c.im.alpha_composite(ic, (int(c.s((L["cw"] - em) / 2.0)),
                              int(c.s(cy + (card - em) / 2.0))))
    bx = (L["cw"] - L["bubble_w"]) / 2.0
    by = L["top_h"] + L["stage_h"] + L["gap"]
    c.rrect(bx, by, L["bubble_w"], L["bubble_h"], L["bubble_h"] / 2.0,
            fill=(255, 255, 255, 26))
    c.text(bx + L["fs"] * 0.9, by + L["bubble_h"] / 2.0,
           "今天也想和你说说话呢", L["fs"], anchor="lm")
    draw_bottombar_emoji(c, L)


def main():
    key = sys.argv[1] if len(sys.argv) > 1 else "rw56"
    sw, sh, _r = MODELS[key]
    L = layout(sw, sh)
    if not os.path.isdir(OUT):
        os.makedirs(OUT)

    if not L["can_tachie"]:
        # 手环 10：不支持立绘模式，只出表情包那张（底栏没有切换键）
        c = Canvas(sw, sh, L["k"])
        draw_emoji_mode(c, L)
        c.im.convert("RGB").save(os.path.join(OUT, "index_%s_emoji.png" % key))
        print("产物在 preview/：%dx%d 物理像素（画布 %dx%d）—— 该机型不支持立绘模式"
              % (sw, sh, L["cw"], L["ch"]))
        return

    # ① 立绘模式：干净状态（无按钮）
    c = Canvas(sw, sh, L["k"])
    draw_tachie(c, L, "shiguang")
    draw_tbubble(c, L, "今天也想和你说说话呢")
    c.im.convert("RGB").save(os.path.join(OUT, "index_%s_tachie.png" % key))

    # ② 立绘模式：长按后顶栏底栏浮出
    c = Canvas(sw, sh, L["k"])
    draw_tachie(c, L, "shiguang")
    draw_tbubble(c, L, "今天也想和你说说话呢")
    draw_topbar(c, L, True)
    draw_bottombar_tachie(c, L)
    c.im.convert("RGB").save(os.path.join(OUT, "index_%s_tachie_chrome.png" % key))

    # ③ 调整面板打开（onAdjust() 里 showBubble = false，气泡此时是隐藏的）
    c = Canvas(sw, sh, L["k"])
    draw_tachie(c, L, "ai1", 0.78)
    draw_apanel(c, L, 0.78)
    c.im.convert("RGB").save(os.path.join(OUT, "index_%s_adjust.png" % key))

    # ④ 放大到 2.4 倍 —— 看「凑近看脸」是不是真的做得到
    c = Canvas(sw, sh, L["k"])
    draw_tachie(c, L, "v4", 2.40, 0.5, 1.15)
    c.im.convert("RGB").save(os.path.join(OUT, "index_%s_zoom.png" % key))

    # ⑤ 表情包模式（对照）
    c = Canvas(sw, sh, L["k"])
    draw_emoji_mode(c, L)
    c.im.convert("RGB").save(os.path.join(OUT, "index_%s_emoji.png" % key))

    print("产物在 preview/：%dx%d 物理像素（画布 %dx%d）" % (sw, sh, L["cw"], L["ch"]))


if __name__ == "__main__":
    main()
