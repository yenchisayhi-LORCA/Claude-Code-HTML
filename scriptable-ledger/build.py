#!/usr/bin/env python3
"""把 page.html、日常記帳的線條圖示和筆記的貼紙樣式（scriptable-notes/stickers.js）塞進 main.js，產生可以直接貼到 Scriptable 的 kids-ledger.js。

用法：python3 scriptable-ledger/build.py
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
tracker = (HERE.parent / "daily-expense-tracker" / "index.html").read_text(encoding="utf-8")

icons = re.search(r"var ICONS = (\[.*?\]);", tracker).group(1)
svgs = re.search(r"var ICON_SVGS = (\{.*?\n  \});", tracker, re.S).group(1)

# 圖示清單：日常記帳那一套（已經有氣球、叉子、飲料杯）加上水果、雨靴、夾腳拖（放在衣服後面）、更多交通工具；貼紙樣式在 stickers.js
# 挑圖示時不顯示 HIDDEN 的天氣圖示，但小工具還是會畫它們，以前選過的照樣顯示
names = json.loads(icons)
assert len(names) == len(set(names)) and "drink" in names
names[names.index("drink") + 1:names.index("drink") + 1] = ["apple", "strawberry", "grape", "watermelon", "orange", "cherry"]
names[names.index("clothes") + 1:names.index("clothes") + 1] = ["rainboot", "flipflop"]
for after, extra in (("travel", ["plane", "planeside"]), ("train", ["steamtrain", "metro"]), ("car", ["carside"])):
    names[names.index(after) + 1:names.index(after) + 1] = extra
HIDDEN = {"partlycloudy", "cloudynight", "overcast", "thunderstorm"}
assert HIDDEN <= set(names)
icons = json.dumps(names)
picker = json.dumps([k for k in names if k not in HIDDEN])
stickers = (HERE.parent / "scriptable-notes" / "stickers.js").read_text(encoding="utf-8").strip()  # 貼紙樣式跟筆記共用

def fill(src, icons=icons):
    for key, val in (("/*ICONS*/[]", icons), ("/*ICON_SVGS*/{}", svgs.strip()), ("/*STICKERS*/", stickers)):
        assert src.count(key) == 1, key
        src = src.replace(key, val)
    return src

page = fill((HERE / "page.html").read_text(encoding="utf-8"), picker)
assert "/*BOOT*/null" in page

main = fill((HERE / "main.js").read_text(encoding="utf-8"))
encoded = json.dumps(page, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
assert main.count('/*PAGE_HTML*/""') == 1
out = main.replace('/*PAGE_HTML*/""', encoded)
(HERE / "kids-ledger.js").write_text(out, encoding="utf-8")
print(f"kids-ledger.js：{len(out.splitlines())} 行、{len(out.encode('utf-8')) // 1024} KB")
