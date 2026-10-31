"""单字页已审定批次的数据与标题字轮廓；在测试服务器运行。

python tools/build-zi.py --batch docs/review-m22/zi/batch1.tsv \
  --content docs/review-m22/zi/content/zi.json --research /path/to/m22-research
输入是已有的原创审定稿、Unihan 18.0.0 与 Wikidata CC0 聚合资料，不取现代字典释义。
字体地址、校验与缺字规则复用 subset-fonts.py；SVG 只含路径，页面不按姓名请求字体。
"""
import argparse
import csv
import importlib.util
import io
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--batch", required=True)
    p.add_argument("--content", required=True)
    p.add_argument("--research", type=Path, required=True)
    args = p.parse_args()
    rows = [line.split("\t") for line in Path(args.batch).read_text().splitlines() if not line.startswith("#")]
    content = json.loads(Path(args.content).read_text())
    assert 342 <= len(rows) == len(content) <= 2015
    assert [r[2] for r in rows] == list(content)
    spec = importlib.util.spec_from_file_location("fonts", "tools/subset-fonts.py")
    fonts = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fonts)
    spec = importlib.util.spec_from_file_location("unihan", "tools/build-quming.py")
    uh = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(uh)
    u = uh.load_unihan()
    freq = json.loads((args.research / "wd_freq2.json").read_text())
    whitelist = set(freq["whitelist"])
    names = set()
    for path in sorted(args.research.glob("wd_*.csv")):
        for row in csv.DictReader(path.open()):
            name, year = row["l"].strip(), row["y"]
            if re.fullmatch(r"[㐀-鿿\U00020000-\U0003FFFF]{2,4}", name) and not (year and int(year) < 1900):
                names.add("".join((uh.cps(u.get(c, {}).get("kSimplifiedVariant", "")) or [c])[0] for c in name))
    positions = defaultdict(Counter)
    given, surnames = Counter(), Counter()
    count = 0
    for name in names:
        if name[:2] in whitelist and len(name) in (3, 4):
            surname, rest = name[:2], name[2:]
        elif name[0] in whitelist and len(name) in (2, 3):
            surname, rest = name[0], name[1:]
        else:
            continue
        count += 1
        surnames[surname] += 1
        for i, c in enumerate(rest):
            given[c] += 1
            positions[c]["single" if len(rest) == 1 else "first" if i == 0 else "second"] += 1
    assert count == 71442
    assert dict(given) == dict(freq["given"])
    fs = {key: TTFont(io.BytesIO(fonts.load(key))) for key in ["xiaowei", "serif-sc", "iansui", "wenkai-tc"]}
    fs["serif-sc"] = instantiateVariableFont(fs["serif-sc"], {"wght": 400})
    def glyph(c, hant):
        key = "iansui" if hant else "serif-sc" if c in fonts.NO_XIAOWEI else "xiaowei"
        font = fs[key]
        if ord(c) not in font.getBestCmap():
            key = "wenkai-tc" if hant else "serif-sc"
            font = fs[key]
        assert ord(c) in font.getBestCmap(), c
        gs = font.getGlyphSet()
        pen = SVGPathPen(gs)
        gs[font.getBestCmap()[ord(c)]].draw(pen)
        em = font["head"].unitsPerEm
        bounds = BoundsPen(gs)
        gs[font.getBestCmap()[ord(c)]].draw(bounds)
        x0, y0, x1, y1 = bounds.bounds
        size = max(em, x1 - x0, y1 - y0)
        return {"d": pen.getCommands(), "box": f"{(x0+x1-size)/2} {(-y0-y1-size)/2} {size} {size}", "font": key}
    meta = {}
    dictionary = json.loads(Path("src/data/quming-zi.json").read_text())
    def book(c):
        pos = u[c].get("kKangXi", "").split()
        if not pos:
            return None
        page, idx = pos[0].split(".")
        return {"page": int(page), "index": int(idx[:2])}
    rank = {c: i + 1 for i, (c, _) in enumerate(freq["given"])}
    for row in rows:
        c = row[2]
        assert given[c] == int(row[3]) and surnames[c] == int(row[4]), c
        text = content[c]
        forms = dictionary["g"][c].split(";")
        form = forms[4][0] if len(forms) > 4 and forms[4] else c
        meta[c] = {"given": given[c], "surname": surnames[c], "rank": rank.get(c), "pos": [positions[c][k] for k in ["first", "second", "single"]],
                   "tgh": int(row[5]), "strokes": int(u[c]["kTotalStrokes"].split()[0]), "strokesHant": int(u[text["hant"]]["kTotalStrokes"].split()[0]),
                   "book": book(form), "bookHant": book(text["hant"]), "glyph": glyph(c, False), "glyphHant": glyph(text["hant"], True)}
    Path("src/data/zi.json").write_text(json.dumps(content, ensure_ascii=False, indent="\t") + "\n")
    Path("src/data/zi-meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(meta)} 字，简繁标题路径齐全；{count} 个公开名字的聚合计数一致")


if __name__ == "__main__":
    main()
