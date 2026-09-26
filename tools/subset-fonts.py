"""
首屏字形子集。

首屏只用到几十个字，但 @fontsource 的切片按 unicode-range 分，这几十个字散落在
十几片里，首屏要下载五百多 KB 字体。这里从完整字体里只取首屏的字，打成两个小文件
（src/fonts/，构建时 Vite 给文件名加哈希，重新生成后不会被旧缓存卡住），
并写出 src/styles/fonts.css：它在 fontsource 之后声明，unicode-range 只含这些字，
浏览器遇到这些字就用小文件，不再去拉大切片。其余的字照旧走 fontsource。

首屏文案改了就重跑（在测试服务器上，不在本机）：
  ssh $STAGE 'cd ~/liuyao && docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v ~/liuyao:/app -w /app \
    python:3.12-slim sh -c "pip install -q --user fonttools==4.* brotli && python tools/subset-fonts.py"'
  然后把 src/fonts/home-*.woff2、src/fonts/gua/ 和 src/styles/fonts.css 拷回本机提交。
漏掉的字不会出错，只是回到 fontsource 的切片，慢一些。

卦页（/gua/…）另外每页一份站酷小薇子集：页头、起卦块、卦名、卦辞、爻辞用小薇，一页要用到的字散在二十来片
里（一百多万字节），打成一页一个小文件（平均十几 KB）预加载，首次渲染就是小薇，不再换字体。
输出 src/fonts/gua/{slug}.woff2 和 src/fonts/gua/ranges.json（每页的 unicode-range，取自子集
实际含有的字），卦页在自己的 <head> 里内联 @font-face。改了 guaci.json、gua-slugs.ts 就重跑，
把 src/fonts/gua/ 一起拷回提交。
"""
import io
import json
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# google/fonts 上的完整字体（OFL），固定到一个提交，结果可复现。
REPO = "https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl"
FONTS = {
    "display": ("ZCOOL XiaoWei", f"{REPO}/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf"),
    "body": ("Noto Serif SC", f"{REPO}/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"),
}

GANZHI = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥年月日"
TEXT = {
    # 竖排标语、印章
    "display": "心有所疑不妨一问爻",
    # 品牌、往卦、起卦、提示、手动排盘、桌面竖排小字、干支日期
    "body": "六爻往卦起一事问次摇手动排盘寂然不感而遂通" + GANZHI + " ·\u3000",
}


# 爻辞行：初九：… 六二：… 上六：… 用九：…
YAO = re.compile(r"^(初|上|用)?[六九][二三四五]?：")


def ranges(chars: str) -> str:
    return ", ".join(f"U+{ord(c):04X}" for c in sorted(set(chars)))


def load(key: str) -> bytes:
    return urllib.request.urlopen(FONTS[key][1]).read()


def make_subset(raw: bytes, text: str) -> TTFont:
    # 不写入当前时间，重跑结果逐字节相同，git 里不出现无谓的改动。
    font = TTFont(io.BytesIO(raw), recalcTimestamp=False)
    if "fvar" in font:
        # 名称表里仍写 ExtraLight（instancer 不改名），字形确是 400，不影响使用。
        font = instancer.instantiateVariableFont(font, {"wght": 400})
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]  # 竖排要用 vert / vrt2
    options.name_IDs = ["*"]  # OFL：版权与许可信息随字体走
    sub = subset.Subsetter(options)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = "woff2"
    return font


# 卦页、目录页都有的小薇字：页头印章、页底起卦块的标语。
CHROME = "爻心有所疑，不妨一问"


def gua_pages() -> dict[str, str]:
    """每页用站酷小薇显示的全部字。按区块算，规则同 src/lib/gua.ts 的 fontOf：
    卦名、卦辞各一块，全部爻辞算一块，含小薇缺字的整块用宋体，不算在内。"""
    slugs = re.findall(r'\["(.+?)", "([a-z-]+)"\]', open("src/data/gua-slugs.ts", encoding="utf-8").read())
    guaci = json.load(open("src/data/guaci.json", encoding="utf-8"))
    pages = {"index": [CHROME, "六十四卦"]}  # 目录页的标题
    for name, slug in slugs:
        lines = guaci[name].split("\n")
        pages[slug] = [CHROME, name, lines[1], "".join(l[3:] for l in lines if YAO.match(l))]
    has = TTFont(io.BytesIO(DISPLAY), lazy=True).getBestCmap()
    # 空格：浏览器按含空格的第一个字体定行高与基线，子集里没有空格，小薇的段落会随别的字体加载而上下微移。
    return {slug: " " + "".join(b for b in blocks if all(ord(c) in has for c in b)) for slug, blocks in pages.items()}


def main() -> None:
    css = [
        "/* 生成文件，勿手改：tools/subset-fonts.py。首屏的字走这里的小文件，须在 fontsource 之后引入。 */"
    ]
    for key, (family, _) in FONTS.items():
        font = make_subset(DISPLAY if key == "display" else load(key), TEXT[key])
        path = f"src/fonts/home-{key}.woff2"
        font.save(path)
        css.append(
            "@font-face {\n"
            f"  font-family: '{family}';\n"
            "  font-style: normal;\n"
            "  font-weight: 400;\n"
            "  font-display: swap;\n"
            f"  src: url('../fonts/home-{key}.woff2') format('woff2');\n"
            f"  unicode-range: {ranges(TEXT[key])};\n"
            "}"
        )
        print(path, len(set(TEXT[key])), "chars")
    with open("src/styles/fonts.css", "w", encoding="utf-8") as f:
        f.write("\n".join(css) + "\n")

    gua = {}
    for slug, text in gua_pages().items():
        font = make_subset(DISPLAY, text)
        font.save(f"src/fonts/gua/{slug}.woff2")
        # 只写子集里真有的字：写了没有的字，浏览器会拿这个文件去找，又落回逐字回退。
        gua[slug] = ranges("".join(chr(c) for c in font.getBestCmap()))
    with open("src/fonts/gua/ranges.json", "w", encoding="utf-8") as f:
        json.dump(gua, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print("src/fonts/gua/", len(gua), "pages")


if __name__ == "__main__":
    DISPLAY = load("display")
    main()
