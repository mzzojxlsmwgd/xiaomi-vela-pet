# -*- coding: utf-8 -*-
"""
布局几何校验：把各页 apply() 里的算法在 Python 里复算一遍。

检查 4 款目标机型上：
  index.ux
    1) 四段高度之和 == 画布高（不溢出、不留缝）
    2) 顶部信息钮 / 底部设置钮 / 表情卡片 / 文字气泡 都不落进屏幕圆角裁切区
    3) 触摸目标物理尺寸 >= 40px
  inbox.ux（v2.9 只显示标题）
    4) 标题（最长 MAX_TITLE_LEN 字）在 midW 内放得下 —— 这是「标题显示不全」的根因检查
    5) 行高 >= 文字行高 + 上下留白（否则底部被裁）
    6) perPage 行 + 分页条 不超出 body

v2.9.5 起光斑层已取消（纯黑底），不再校验光斑位置。

用法：python tools/verify_layout.py
"""
import math
import sys

DW = 480
MAX_TITLE_LEN = 10          # 与 src/config/story-meta.js 保持一致

DEVICES = [
    ("小米手环 10", 212, 520, 46),
    ("小米手环 10 Pro", 480, 336, 44),
    ("红米手表 5", 432, 514, 90),
    ("红米手表 6", 432, 514, 26),
]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ---------------- index.ux ----------------

def layout_index(sw, sh):
    k = DW / float(sw)
    cw = DW
    ch = int(round(sh * k))
    btn_phys = clamp(sw * 0.1, 40, 54)
    btn = int(round(btn_phys * k))
    fs_phys = clamp(sw * 0.042, 12, 18)
    fs = int(round(fs_phys * k))
    pad = int(round(ch * 0.03))
    # 窄屏（手环 10）顶部拆两行：第一行消息按钮，第二行时钟+好感
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
    return dict(k=k, cw=cw, ch=ch, btn=btn, fs=fs, pad=pad, top_h=top_h,
                bot_h=bot_h, gap=gap, bubble_h=bubble_h, stage_h=stage_h,
                emoji=emoji, card=card, bubble_w=bubble_w,
                narrow=narrow, aff_h=aff_h, row_gap=row_gap)


# ---------------- inbox.ux ----------------

def layout_inbox(sw, sh):
    k = DW / float(sw)
    ch = int(round(sh * k))
    btn_phys = clamp(sw * 0.105, 38, 56)
    btn = int(round(btn_phys * k))
    fs_phys = clamp(sw * 0.042, 12, 20)
    fs = int(round(fs_phys * k))
    top_h = btn + int(round(DW * 0.06))
    body_h = ch - top_h
    pg_h = int(round(fs * 2.6))

    narrow = sw < 280
    pad_v0 = int(round(fs * 0.58))
    ava0 = min(int(round(fs * (2.5 if narrow else 2.2))), int(round(DW * 0.24)))
    gap_h = max(8, int(round(fs * 0.5)))
    avail_h = body_h - pg_h - gap_h
    row_h = max(ava0 + pad_v0 * 2, int(round(fs * 2.4)))
    per_page = int(math.floor(avail_h / float(row_h + gap_h)))
    if per_page < 3:
        row_h = max(int(round(fs * 1.9)), int(math.floor(avail_h / 3.0)) - gap_h)
        per_page = int(math.floor(avail_h / float(row_h + gap_h)))
    per_page = clamp(per_page, 1, 7)
    row_cap = int(round(fs * 4.2))
    row_h = min(row_cap, max(row_h, int(math.floor(avail_h / float(per_page))) - gap_h))

    pad_v = min(pad_v0, max(2, int(round(row_h * 0.24))))
    ava = min(ava0, max(1, row_h - pad_v * 2))
    row_w = DW - int(round(DW * 0.16))
    row_pad_h = min(int(round(row_h * 0.2)), int(round(fs * 0.8)))
    dot_w = int(round(fs * 0.8))
    mid_gap = int(round(row_h * 0.16))
    mid_w = max(40, row_w - row_pad_h * 2 - ava - mid_gap - dot_w)

    fit_fs = int(math.floor(mid_w / (MAX_TITLE_LEN * 1.04)))
    name_fs = max(int(round(fs * 0.78)), min(int(round(fs * 1.06)), fit_fs))
    name_lh = int(round(name_fs * 1.34))
    if row_h < name_lh + pad_v * 2:
        row_h = name_lh + pad_v * 2
        per_page = clamp(int(math.floor(avail_h / float(row_h + gap_h))), 1, 7)
    per_page = clamp(per_page, 1, 7)
    return dict(k=k, ch=ch, btn=btn, fs=fs, top_h=top_h, body_h=body_h, pg_h=pg_h,
                pad_v=pad_v, ava=ava, gap_h=gap_h, row_h=row_h, row_w=row_w,
                row_pad_h=row_pad_h, mid_w=mid_w, name_fs=name_fs,
                name_lh=name_lh, per_page=per_page, dot_w=dot_w, narrow=narrow)


# ---------------- 通用几何 ----------------

def pt_in(x, y, W, H, r):
    """点是否落在圆角矩形内部"""
    if x < r and y < r:
        return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if x > W - r and y < r:
        return (x - (W - r)) ** 2 + (y - r) ** 2 <= r * r
    if x < r and y > H - r:
        return (x - r) ** 2 + (y - (H - r)) ** 2 <= r * r
    if x > W - r and y > H - r:
        return (x - (W - r)) ** 2 + (y - (H - r)) ** 2 <= r * r
    return True


def rect_ok(x0, y0, x1, y1, W, H, r):
    if x0 < 0 or y0 < 0 or x1 > W or y1 > H:
        return False, "超出屏幕"
    for x in (x0, x1):
        for y in (y0, y1):
            if not pt_in(x, y, W, H, r):
                return False, "落进圆角"
    for t in range(11):
        x = x0 + (x1 - x0) * t / 10.0
        for y in (y0, y1):
            if not pt_in(x, y, W, H, r):
                return False, "落进圆角"
    return True, ""


def glow_box(cx, cy, d, cw, ch):
    """与 theme.js 的 glowStyle() 完全一致"""
    dd = max(1, min(d, min(cw, ch)))
    x = min(max(cx - dd / 2.0, 0), max(0, cw - dd))
    y = min(max(cy - dd / 2.0, 0), max(0, ch - dd))
    return x, y, x + dd, y + dd


def main():
    ok_all = True
    print("%-16s %-11s %-5s %-6s %-6s %-7s %-8s %s" %
          ("机型", "分辨率", "圆角", "按钮", "字号", "表情", "占短边", "index 结论"))
    print("-" * 96)

    for name, sw, sh, r in DEVICES:
        L = layout_index(sw, sh)
        k = L["k"]
        r_css = r * k
        W, H = L["cw"], L["ch"]
        problems = []

        total = L["top_h"] + L["stage_h"] + L["bubble_h"] + L["gap"] + L["bot_h"]
        if total != H:
            problems.append("高度合计 %d != 画布 %d" % (total, H))

        # 顶部：宽屏一行（信息钮 + 时钟 + 好感胶囊）；窄屏两行（按钮一行，时间+好感一行）
        clock_w = int(round(5 * 0.56 * L["fs"] * 1.15))
        aff_w = int(round(L["fs"] * 4.2))
        if L["narrow"]:
            # 第一行：消息按钮居中
            bx = (W - L["btn"]) / 2.0
            ok, why = rect_ok(bx, L["pad"], bx + L["btn"], L["pad"] + L["btn"], W, H, r_css)
            if not ok:
                problems.append("顶部信息钮 %s" % why)
            # 第二行：时钟 + 好感胶囊居中
            row2_w = clock_w + int(round(L["fs"] * 0.5)) + aff_w
            rx = (W - row2_w) / 2.0
            ry = L["pad"] + L["btn"] + L["row_gap"]
            ok, why = rect_ok(rx, ry, rx + row2_w, ry + L["aff_h"], W, H, r_css)
            if not ok:
                problems.append("顶部时间好感行 %s" % why)
        else:
            gap = int(round(L["fs"] * 0.7))
            group_w = L["btn"] + gap + clock_w + gap + aff_w
            gx = (W - group_w) / 2.0
            ok, why = rect_ok(gx, L["pad"], gx + L["btn"], L["pad"] + L["btn"], W, H, r_css)
            if not ok:
                problems.append("顶部信息钮 %s" % why)

        # 底部：设置钮居中
        bx = (W - L["btn"]) / 2.0
        by = H - L["bot_h"] + L["pad"]
        ok, why = rect_ok(bx, by, bx + L["btn"], by + L["btn"], W, H, r_css)
        if not ok:
            problems.append("底部设置钮 %s" % why)

        # 表情卡片（圆角矩形）
        cx0 = (W - L["card"]) / 2.0
        cy0 = L["top_h"] + (L["stage_h"] - L["card"]) / 2.0
        ok, why = rect_ok(cx0, cy0, cx0 + L["card"], cy0 + L["card"], W, H, r_css)
        if not ok:
            problems.append("表情卡片 %s" % why)

        # 文字气泡
        bbx = (W - L["bubble_w"]) / 2.0
        bby = L["top_h"] + L["stage_h"] + L["gap"]
        ok, why = rect_ok(bbx, bby, bbx + L["bubble_w"], bby + L["bubble_h"], W, H, r_css)
        if not ok:
            problems.append("文字气泡 %s" % why)

        # 触摸尺寸（物理像素）
        if L["btn"] / k < 39.5:
            problems.append("按钮物理尺寸 %.1f < 40" % (L["btn"] / k))
        # 下限 12 经 round(k) 后可能落到 11.9x，留一点取整余量
        if L["fs"] / k < 11.85:
            problems.append("字号物理 %.1f 偏小" % (L["fs"] / k))

        emoji_phys = L["emoji"] / k
        ratio = emoji_phys / min(sw, sh)
        # 窄屏（手环 10）要求表情占短边 70% 以上 —— v2.9.4 专门放大过
        floor_ratio = 0.70 if sw < 280 else 0.36
        if ratio < floor_ratio:
            problems.append("表情包偏小（短边 %d%% < %d%%）" % (round(ratio * 100), round(floor_ratio * 100)))

        print("%-16s %-11s %-5d %-6d %-6.1f %-7.0f %-8s %s" % (
            name, "%dx%d" % (sw, sh), r, round(L["btn"] / k), L["fs"] / k, emoji_phys,
            "%d%%" % round(ratio * 100), "OK" if not problems else " / ".join(problems)))
        if problems:
            ok_all = False

    # ---------------- inbox ----------------
    print()
    print("%-16s %-8s %-6s %-6s %-7s %-6s %-7s %s" %
          ("机型", "行高", "标题px", "标题占宽", "每页", "分页后", "标题行高", "inbox 结论"))
    print("-" * 96)
    for name, sw, sh, r in DEVICES:
        L = layout_inbox(sw, sh)
        k = L["k"]
        r_css = r * k
        W, H = DW, L["ch"]
        problems = []

        # ① 最长标题必须放得下（这是「标题显示不全」的直接判据）
        need_w = MAX_TITLE_LEN * L["name_fs"]
        if need_w > L["mid_w"]:
            problems.append("最长标题 %dpx > 可用 %dpx" % (need_w, L["mid_w"]))

        # ② 行高必须容得下文字行高 + 上下留白
        if L["name_lh"] + L["pad_v"] * 2 > L["row_h"]:
            problems.append("行高 %d 容不下文字 %d" % (L["row_h"], L["name_lh"] + L["pad_v"] * 2))

        # ③ 一页的行 + 分页条不能超出 body
        used = L["per_page"] * (L["row_h"] + L["gap_h"]) + L["pg_h"]
        if used > L["body_h"]:
            problems.append("分页后 %d > body %d" % (used, L["body_h"]))
        if L["per_page"] < 3:
            problems.append("每页只有 %d 行" % L["per_page"])

        # ④ 首行左右不落进圆角
        rx = (W - L["row_w"]) / 2.0
        ok, why = rect_ok(rx, L["top_h"], rx + L["row_w"], L["top_h"] + L["row_h"], W, H, r_css)
        if not ok:
            problems.append("首行 %s" % why)

        print("%-16s %-8d %-6d %-6s %-7d %-6d %-7d %s" % (
            name, L["row_h"], L["name_fs"], "%d/%d" % (need_w, L["mid_w"]),
            L["per_page"], used, L["name_lh"] + L["pad_v"] * 2,
            "OK" if not problems else " / ".join(problems)))
        if problems:
            ok_all = False

    # ---------------- 光斑（v2.9.5 已取消，不再有装饰层） ----------------
    print()
    print("装饰层：已取消高斯光斑（纯黑底），无溢出风险")

    print()
    print("画布基准 designWidth = %d（CSS px）" % DW)
    for name, sw, sh, r in DEVICES:
        L = layout_index(sw, sh)
        print("  %-16s 画布 %dx%d，顶栏 %d / 舞台 %d / 气泡 %d / 底栏 %d" % (
            name, L["cw"], L["ch"], L["top_h"], L["stage_h"], L["bubble_h"], L["bot_h"]))
    print()
    if ok_all:
        print("全部机型布局校验通过")
        return 0
    print("存在布局问题，请修正 apply()")
    return 1


if __name__ == "__main__":
    sys.exit(main())
