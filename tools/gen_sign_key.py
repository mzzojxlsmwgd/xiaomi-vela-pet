#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成打包用的签名密钥（RSA 2048 + 自签证书）

    python tools/gen_sign_key.py

产物：
    sign/private.pem        私钥（**绝对不要提交到仓库、不要发给别人**）
    sign/certificate.pem    自签证书（打包时一起用）

只有 `aiot release`（正式包）需要签名；`aiot build`（调试包）用内置调试签名，
不需要这两个文件。

依赖：本机装了 openssl（Windows 装 Git 自带的那份即可，或单独装 OpenSSL）
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIGN = os.path.join(ROOT, "sign")
KEY = os.path.join(SIGN, "private.pem")
CRT = os.path.join(SIGN, "certificate.pem")

SUBJECT = "/C=CN/O=VelaPetFramework/CN=vela-pet-framework"


def main():
    if not shutil.which("openssl"):
        print("!! 找不到 openssl。Windows 上装 Git 就自带，或从 https://slproweb.com 装 OpenSSL")
        sys.exit(1)

    if os.path.exists(KEY) or os.path.exists(CRT):
        print("!! sign/ 里已经有密钥了，先手动删掉再跑：")
        print("   " + KEY)
        print("   " + CRT)
        sys.exit(1)

    os.makedirs(SIGN, exist_ok=True)

    print("生成私钥 …")
    subprocess.run(["openssl", "genrsa", "-out", KEY, "2048"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print("生成自签证书 …")
    subprocess.run([
        "openssl", "req", "-new", "-x509", "-key", KEY, "-out", CRT,
        "-days", "3650", "-subj", SUBJECT
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print("\n完成：")
    for p in (KEY, CRT):
        print("  %s  %.1f KB" % (os.path.relpath(p, ROOT),
                                 os.path.getsize(p) / 1024.0))
    print("\n注意：")
    print("  · sign/ 已经在 .gitignore 里，别提交、别外传")
    print("  · 换了密钥后，新包装到手表上会被当成「另一个应用」，")
    print("    老存档不会自动迁移（同一个包名 + 同一个密钥才认作同一个应用）")


if __name__ == "__main__":
    main()
