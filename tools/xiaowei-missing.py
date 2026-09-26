"""
站酷小薇缺哪些字。

卦名、卦辞、爻辞用站酷小薇显示，但小薇只有七千来字，缺的字会逐字回退到宋体，
同一个卦名、同一句卦辞里混着两种字体。src/lib/gua.ts 的 NO_XIAOWEI 就是这里
算出的字：一段文字里只要有其中一个，整段改用宋体。

读的是 node_modules 里 @fontsource/zcool-xiaowei 的全部切片，也就是页面实际加载的字；
文字取 guaci.json 的卦名、卦辞、爻辞（彖传、象传用宋体，不算）。
换字体版本或改了 guaci.json 就重跑（在测试服务器上，不在本机；先要装好依赖）：
  ssh $STAGE 'cd ~/liuyao && docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v ~/liuyao:/app -w /app \
    python:3.12-slim sh -c "pip install -q --user fonttools==4.* brotli && python tools/xiaowei-missing.py"'
把输出的字抄进 NO_XIAOWEI。
"""
import glob
import json
import re

from fontTools.ttLib import TTFont

has = set()
for path in glob.glob("node_modules/@fontsource/zcool-xiaowei/files/*-400-normal.woff2"):
    has |= set(TTFont(path)["cmap"].getBestCmap())

text = ""
for name, body in json.load(open("src/data/guaci.json", encoding="utf-8")).items():
    lines = body.split("\n")
    text += name + lines[1]  # 卦名、卦辞
    text += "".join(l for l in lines if re.match(r"^(初|上|用)?[六九][二三四五]?：", l))  # 爻辞

print("".join(sorted({c for c in text if ord(c) not in has and not c.isspace()})))
