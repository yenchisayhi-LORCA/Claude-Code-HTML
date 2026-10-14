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

# 圖示清單：完整的順序寫在這裡（日常記帳的清單只放挑得到的，會少了下面 HIDDEN 那些）；日常記帳有、這裡沒有的接在最後
# 挑圖示時不顯示 HIDDEN 的，但小工具還是會畫它們，以前選過的照樣顯示；貼紙樣式在 stickers.js
ORDER = ["lion", "pig", "giraffe", "bear", "monkey", "bee", "owl", "fox", "sheep", "penguin", "koala", "frog", "rabbit",
         "star", "heart", "diamond", "music", "clothes", "rainboot", "flipflop", "pencil", "pets",
         "sun", "moon", "cloud", "partlycloudy", "cloudynight", "overcast", "rain", "thunderstorm", "lightning", "snow", "rainbow",
         "gift", "balloon", "fork", "forkknife", "burger", "pizza", "cake", "drink",
         "apple", "strawberry", "grape", "watermelon", "orange", "cherry", "idea", "shoppingbag",
         "travel", "plane", "planeside", "train", "steamtrain", "metro", "bus", "car", "carside", "bicycle", "camera", "location"]
names = ORDER + [k for k in json.loads(icons) if k not in ORDER]
assert len(names) == len(set(names))
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
