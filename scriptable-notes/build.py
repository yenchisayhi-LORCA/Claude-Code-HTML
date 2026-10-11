#!/usr/bin/env python3
"""把 page.html 和日常記帳的線條圖示塞進 main.js，產生可以直接貼到 Scriptable 的 kids-notes.js。

用法：python3 scriptable-notes/build.py
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
tracker = (HERE.parent / "daily-expense-tracker" / "index.html").read_text(encoding="utf-8")

icons = re.search(r"var ICONS = (\[.*?\]);", tracker).group(1)
svgs = re.search(r"var ICON_SVGS = (\{.*?\n  \});", tracker, re.S).group(1)

page = (HERE / "page.html").read_text(encoding="utf-8")
page = page.replace("/*ICONS*/[]", icons).replace("/*ICON_SVGS*/{}", svgs.strip())
assert "/*BOOT*/null" in page

main = (HERE / "main.js").read_text(encoding="utf-8")
encoded = json.dumps(page, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
assert main.count('/*PAGE_HTML*/""') == 1
out = main.replace('/*PAGE_HTML*/""', encoded)
(HERE / "kids-notes.js").write_text(out, encoding="utf-8")
print(f"kids-notes.js：{len(out.splitlines())} 行、{len(out.encode('utf-8')) // 1024} KB")
