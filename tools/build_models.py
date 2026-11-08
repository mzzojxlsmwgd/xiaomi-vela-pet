# -*- coding: utf-8 -*-
"""
分机型打包 —— 一次产出「正式版」和「开发者版」两套 rpk。

正式版（DEV_MODE=0）
  · 包名 = manifest 里的 package
  · 没有开发者功能：好感度永远按真实值算，设置页不出现开发者那两行
  · 四个机型各一个包

开发者版（DEV_MODE=1）
  · 包名 = <package>.dev，应用名后缀「·开发」
  · 好感度默认满值、全部剧情可看，设置页多两条开发者选项
  · 只出红米手表 6 一个包（432x514）
  · 独立包名 → 可以和正式版同时装在表上，存档互不干扰

每个包都会写死两件事（避免源码里残留别的机型）：
  src/config/device-target.js   TARGET = {W, H, MODEL}
  src/config/build-mode.js      DEV_MODE = 0/1

前置条件：
  npm install              # 装 aiot-toolkit
  node 在 PATH 里（或用环境变量 NODE_BIN 指定）

用法：
  python tools/build_models.py
"""
import json
import os
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = os.environ.get("NODE_BIN") or shutil.which("node") or "node"
TOOLKIT = os.path.join(ROOT, "node_modules", "aiot-toolkit", "bin", "index.js")
TARGET_JS = os.path.join(ROOT, "src", "config", "device-target.js")
MODE_JS = os.path.join(ROOT, "src", "config", "build-mode.js")
MANIFEST = os.path.join(ROOT, "src", "manifest.json")
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(ROOT, "packages")

# 机型表：(key, 中文名, 物理宽, 物理高, versionCode, dev_mode)
# 新增机型就往这里加一行；device-target.js 会被自动写对。
MODELS = [
    ("mb10",    "小米手环10",      212, 520, 1, 0),
    ("mb10pro", "小米手环10 Pro",  480, 336, 2, 0),
    ("rw5",     "红米手表5",       432, 514, 3, 0),
    ("rw6",     "红米手表6",       432, 514, 4, 0),
    # 开发者版只做红米手表 6
    ("rw6",     "红米手表6",       432, 514, 5, 1),
]

# 源码恢复用的默认机型（打包完会写回去，避免残留某个机型）
DEFAULT_TARGET = (432, 514, "rw5")
DEFAULT_VC = 1


def read_manifest():
    with open(MANIFEST, "r", encoding="utf-8") as f:
        return json.load(f)


def write_manifest(m):
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
        f.write("\n")   # json.dump 不补行尾换行，写回去会让 git 显示「无换行结尾」


def write_target(w, h, model):
    with open(TARGET_JS, "w", encoding="utf-8") as f:
        f.write(
            "/**\n"
            " * 机型目标分辨率（自动生成，勿手改）。\n"
            " * 由 tools/build_models.py 按机型写入 W/H/MODEL。\n"
            " */\n"
            "export const TARGET = { W: %d, H: %d, MODEL: '%s' }\n" % (w, h, model)
        )


def write_mode(dev):
    with open(MODE_JS, "w", encoding="utf-8") as f:
        f.write(
            "/**\n"
            " * 构建模式（自动生成，勿手改）。\n"
            " * 由 tools/build_models.py 在打包前写入：\n"
            " *   DEV_MODE = 0 → 正式版：没有开发者功能，好感度永远按真实值算\n"
            " *   DEV_MODE = 1 → 开发者版：好感度默认满、全部剧情可看，设置页多两条开发者选项\n"
            " */\n"
            "export const DEV_MODE = %d\n" % dev
        )


def patch_manifest(vc, dev):
    m = read_manifest()
    base_pkg = m["package"].replace(".dev", "")
    base_name = m["name"].replace("·开发", "")
    m["versionCode"] = vc
    m["package"] = base_pkg + ".dev" if dev else base_pkg
    m["name"] = base_name + "·开发" if dev else base_name
    write_manifest(m)
    return base_pkg, base_name


def build_one(key, name, w, h, vc, dev):
    tag = "开发者版" if dev else "正式版"
    print("\n=== %s | %s (%s) %dx%d vc=%d ===" % (tag, key, name, w, h, vc))
    if not os.path.isfile(TOOLKIT):
        print("!! 找不到 aiot-toolkit：%s" % TOOLKIT)
        print("   先跑一次 npm install")
        return False
    write_target(w, h, key)
    write_mode(dev)
    pkg, base_name = patch_manifest(vc, dev)
    env = dict(os.environ)
    env["CODEBUDDY_SAFE_DELETE_ENABLED"] = "0"

    # dist/ 偶尔会被杀软或上一个 node 进程短暂占用，导致 rimraf 失败 →
    # 重试最多 3 次，每次先自己清一遍 dist。
    r = None
    for attempt in range(1, 4):
        shutil.rmtree(DIST, ignore_errors=True)
        r = subprocess.run(
            [NODE, TOOLKIT, "release"],
            cwd=ROOT, env=env, capture_output=True, text=True
        )
        if r.returncode == 0 and os.path.isdir(DIST):
            break
        out = (r.stdout or "") + (r.stderr or "")
        print("  第 %d 次失败：%s" % (attempt, out.strip().splitlines()[-1] if out.strip() else "(无输出)"))
        if attempt < 3:
            time.sleep(1.5)
    out = (r.stdout or "") + (r.stderr or "")
    print(out[-800:])
    if r.returncode != 0:
        print("!! 构建失败：%s" % key)
        return False
    if not os.path.isdir(DIST):
        print("!! 没有 dist 产物：%s" % key)
        return False
    rpks = [f for f in os.listdir(DIST) if f.endswith(".rpk")]
    if not rpks:
        print("!! dist 里没有 rpk：%s" % key)
        return False
    os.makedirs(OUT, exist_ok=True)
    ver = read_manifest().get("versionName", "0")
    suffix = "%s.%s.rpk" % (key, ver) if dev else "%s.release.%s.rpk" % (key, ver)
    dest = os.path.join(OUT, pkg + "." + suffix)
    shutil.copyfile(os.path.join(DIST, rpks[0]), dest)
    print("OK -> %s (%.1f KB)" % (os.path.relpath(dest, ROOT),
                                   os.path.getsize(dest) / 1024.0))
    return True


def main():
    os.makedirs(OUT, exist_ok=True)
    ok = True
    for key, name, w, h, vc, dev in MODELS:
        if not build_one(key, name, w, h, vc, dev):
            ok = False
    # 恢复源码默认状态（正式版 / 红米手表5），避免残留某机型或开发者模式
    write_target(*DEFAULT_TARGET)
    write_mode(0)
    patch_manifest(DEFAULT_VC, 0)
    if ok:
        pkg = read_manifest()["package"]
        print("\n全部构建完成，产物在 packages/")
        print("  正式版 4 个：%s.<机型>.release.<版本>.rpk" % pkg)
        print("  开发者版 1 个：%s.dev.rw6.<版本>.rpk" % pkg)
    else:
        print("\n部分机型构建失败，请检查上面的输出")
        sys.exit(1)


if __name__ == "__main__":
    main()
