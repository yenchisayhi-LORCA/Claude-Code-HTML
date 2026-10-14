#!/usr/bin/env python3
"""把 page.html、日常記帳的線條圖示和 stickers.js 的貼紙樣式塞進 main.js，產生可以直接貼到 Scriptable 的 kids-notes.js。

用法：python3 scriptable-notes/build.py
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
tracker = (HERE.parent / "daily-expense-tracker" / "index.html").read_text(encoding="utf-8")

icons = re.search(r"var ICONS = (\[.*?\]);", tracker).group(1)
svgs = re.search(r"var ICON_SVGS = (\{.*?\n  \});", tracker, re.S).group(1)

# 圖示清單：日常記帳那一套（已經有氣球、叉子、飲料杯）加上水果、雨靴、夾腳拖（放在衣服後面）、更多交通工具和餐飲；貼紙樣式在 stickers.js
# 挑圖示時不顯示 HIDDEN 的天氣圖示和舊的火車、公車、汽車、西瓜、腳踏車、夾腳拖、雪、叉子、柳橙，但小工具還是會畫它們，以前選過的照樣顯示
names = json.loads(icons)
assert len(names) == len(set(names)) and "drink" in names
# 日常記帳的清單可能已經有其中幾個（也可能拿掉了舊的天氣圖示），沒有的才補上
for after, extra in (("cloud", ["partlycloudy", "cloudynight", "overcast"]), ("rain", ["thunderstorm"]),
                     ("drink", ["apple", "strawberry", "grape", "watermelon", "orange", "cherry"]),
                     ("clothes", ["rainboot", "flipflop"]), ("travel", ["plane", "planeside"]),
                     ("train", ["steamtrain", "metro"]), ("car", ["carside"]),
                     ("fork", ["forkknife", "burger", "pizza", "cake"])):
    at = names.index(after) + 1
    for k in extra:
        if k not in names:
            names.insert(at, k)
        at = names.index(k) + 1
HIDDEN = {"partlycloudy", "cloudynight", "overcast", "thunderstorm", "train", "bus", "car", "watermelon", "bicycle", "flipflop", "snow", "fork", "orange"}
assert HIDDEN <= set(names)
icons = json.dumps(names)
picker = json.dumps([k for k in names if k not in HIDDEN])
stickers = (HERE / "stickers.js").read_text(encoding="utf-8").strip()

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
(HERE / "kids-notes.js").write_text(out, encoding="utf-8")
print(f"kids-notes.js：{len(out.splitlines())} 行、{len(out.encode('utf-8')) // 1024} KB")
