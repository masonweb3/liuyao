"""
首屏字形子集。

首屏只用到几十个字，但 @fontsource 的切片按 unicode-range 分，这几十个字散落在
十几片里，首屏要下载五百多 KB 字体。这里从完整字体里只取首屏的字，打成两个小文件
（src/fonts/，构建时 Vite 给文件名加哈希，重新生成后不会被旧缓存卡住），
并写出 src/styles/fonts.css：它在 fontsource 之后声明，unicode-range 只含这些字，
浏览器遇到这些字就用小文件，不再去拉大切片。其余的字照旧走 fontsource。

首屏文案改了就重跑（在测试服务器上，不在本机；要先装好依赖，正文补字要读 node_modules 里的 fontsource 切片）：
  ssh $STAGE 'cd ~/liuyao && docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v ~/liuyao:/app -w /app \
    python:3.12-slim sh -c "pip install -q --user fonttools==4.* brotli && python tools/subset-fonts.py"'
  然后把 src/fonts/ 和 src/styles/fonts.css 拷回本机提交。
漏掉的字不会出错，只是回到 fontsource 的切片，慢一些。

卦页另外每页一份标题字体子集，按语言分组输出：
- 简体（/gua/…）：站酷小薇，src/fonts/gua/{slug}.woff2。页头、起卦块、卦名、卦辞、爻辞用小薇，一页要用到的字
  散在二十来片里（一百多万字节），打成一页一个小文件（平均十几 KB）预加载，首次渲染就是小薇，不再换字体。
- 繁体（/zh-hant/gua/…）：芫荽，src/fonts/gua-hant/{slug}.woff2；芫荽缺的生僻字从霞鹜文楷 TC 取，
  另成 {slug}-wk.woff2（本页没有缺字就不生成）。两款同出 Klee One，补上的字看不出差别。
每组一个 ranges.json（每个文件的 unicode-range，取自子集实际含有的字），卦页在自己的 <head> 里内联 @font-face。
改了 guaci.json、guaci-hant.json、gua-slugs.ts 或这些页面上用标题字体的文案，就重跑，把 src/fonts/ 一起拷回提交。

卦页、目录页的正文（宋体）另有补字，写进 src/styles/paper-fonts.css（Paper.astro 引入，排在 fontsource 之后）：
- src/fonts/body-hans.woff2、body-hant.woff2：fontsource 的 Noto Serif SC / TC 400 切片里没有、正文数据
  （卦爻辞全文、卦辞白话、爻辞白话）却要用的字，从完整字体截出来，不让这些字回退到系统字体。缺哪些字按切片的
  实际 cmap 自动算（切片 CSS 的 unicode-range 比实际字多，不能信），所以要先 pnpm install。每批白话加了字就重跑；
  src/data/glyphs.test.ts 会在缺字时报错。
- src/fonts/lang-400.woff2、lang-600.woff2：页头语言切换「简 | 繁」用的几个字，取 Noto Serif SC 的字形。
  「简」Noto Serif TC 根本没有；其余几个字（当前语言那个字是 600 字重，读屏补字）要是走 fontsource，
  一个字就要多下载一整片（三五十 KB）。

字体源文件不进 git：按下面固定的地址下载，核对 sha256，结果可复现。
"""
import hashlib
import io
import json
import os
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# google/fonts 上的完整字体（OFL），固定到一个提交。霞鹜文楷 TC 用 GitHub 发布的 v1.522：
# Google Fonts（和 fontsource）上还是 v1.330，缺「稊」「胏」。
REPO = "https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl"
SOURCES = {
    "xiaowei": (
        f"{REPO}/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf",
        "a42b620140f493db42f741351dfbf343c0936d58588ee8004b8b2a218d997ff1",
    ),
    "serif-sc": (
        f"{REPO}/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
        "050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9",
    ),
    "serif-tc": (
        f"{REPO}/notoseriftc/NotoSerifTC%5Bwght%5D.ttf",
        "0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6",
    ),
    # 芫荽 Iansui v1.012
    "iansui": (
        f"{REPO}/iansui/Iansui-Regular.ttf",
        "6e6340d80d618a42b48ade9370c34fa37a8210750c6fbc8efe65f23716538a2b",
    ),
    "wenkai-tc": (
        "https://github.com/lxgw/LxgwWenkaiTC/releases/download/v1.522/LXGWWenKaiTC-Regular.ttf",
        "b1a0795862c1415bf3f393ea50b2a4ea6275012cf5bad3f94feeb1222f555731",
    ),
}

# 首屏子集：(字体族名, 源)
HOME = {"display": ("ZCOOL XiaoWei", "xiaowei"), "body": ("Noto Serif SC", "serif-sc")}

GANZHI = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥年月日"
TEXT = {
    # 竖排标语、印章
    "display": "心有所疑不妨一问爻",
    # 品牌、往卦、起卦、提示、手动排盘、桌面竖排小字、干支日期
    "body": "六爻往卦起一事问次摇手动排盘寂然不感而遂通" + GANZHI + " ·　",
}

# 语言切换「简 | 繁」用的字：(补进哪个字体族, 字重) → 字，字形都取 Noto Serif SC。
LANG = {
    ("Noto Serif TC", 400): "简体",  # 繁体页：链接「简」，读屏补字「体」
    ("Noto Serif SC", 400): "體",  # 简体页：读屏补字「體」
    ("Noto Serif TC", 600): "繁",  # 繁体页：当前语言
    ("Noto Serif SC", 600): "简",  # 简体页：当前语言
}

# 正文补字：语言 → (字体族名, 完整字体, fontsource 包, 正文数据)
BODY = {
    "hans": ("Noto Serif SC", "serif-sc", "noto-serif-sc", ["guaci.json", "baihua.json", "yao-baihua.json"]),
    "hant": ("Noto Serif TC", "serif-tc", "noto-serif-tc", ["guaci-hant.json", "baihua-hant.json", "yao-baihua-hant.json"]),
}

# 爻辞行：初九：… 六二：… 上六：… 用九：…
YAO = re.compile(r"^(初|上|用)?[六九][二三四五]?：")

_raw: dict[str, bytes] = {}


def ranges(chars: str) -> str:
    return ", ".join(f"U+{ord(c):04X}" for c in sorted(set(chars)))


def load(key: str) -> bytes:
    if key not in _raw:
        url, sha = SOURCES[key]
        data = urllib.request.urlopen(url).read()
        if hashlib.sha256(data).hexdigest() != sha:
            raise SystemExit(f"{key} 的 sha256 对不上：{url}")
        _raw[key] = data
    return _raw[key]


def cmap(key: str) -> dict[int, str]:
    return TTFont(io.BytesIO(load(key)), lazy=True).getBestCmap()


def make_subset(raw: bytes, text: str, wght: int = 400) -> TTFont:
    # 不写入当前时间，重跑结果逐字节相同，git 里不出现无谓的改动。
    font = TTFont(io.BytesIO(raw), recalcTimestamp=False)
    if "fvar" in font:
        # 名称表里仍写 ExtraLight（instancer 不改名），字形确是所给字重，不影响使用。
        font = instancer.instantiateVariableFont(font, {"wght": wght})
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]  # 竖排要用 vert / vrt2
    options.name_IDs = ["*"]  # OFL：版权与许可信息随字体走
    sub = subset.Subsetter(options)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = "woff2"
    return font


# 卦页、目录页都有的标题字：页头印章、页底起卦块的标语。
CHROME = {"hans": "爻心有所疑，不妨一问", "hant": "爻心有所疑，不妨一問"}


def page_blocks(guaci_path: str, lang: str) -> dict[str, list[str]]:
    """每页用标题字体显示的文字，按区块分：卦名、卦辞各一块，全部爻辞算一块。"""
    slugs = re.findall(r'\["(.+?)", "([a-z-]+)"\]', open("src/data/gua-slugs.ts", encoding="utf-8").read())
    guaci = json.load(open(guaci_path, encoding="utf-8"))
    pages = {"index": [CHROME[lang], "六十四卦"]}  # 目录页的标题
    for name, slug in slugs:
        lines = guaci[name].split("\n")
        # 卦名取首行（繁体多是维基文库页名，如天山遯；無妄、恆是台湾写法，见 build-guaci-hant.py）；简体首行的全名就是键。
        pages[slug] = [CHROME[lang], lines[0].split(" ")[2], lines[1], "".join(l[3:] for l in lines if YAO.match(l))]
    return pages


def save(font: TTFont, path: str) -> tuple[str, int]:
    font.save(path)
    # 只写子集里真有的字：写了没有的字，浏览器会拿这个文件去找，又落回逐字回退。
    return ranges("".join(chr(c) for c in font.getBestCmap())), len(open(path, "rb").read())


def write_ranges(table: dict[str, str], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(table, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")


def gua_hans() -> None:
    """规则同 src/lib/gua.ts 的 fontOf：含小薇缺字的整块用宋体，不算在内。"""
    has = cmap("xiaowei")
    table, sizes = {}, []
    for slug, blocks in page_blocks("src/data/guaci.json", "hans").items():
        # 空格：浏览器按含空格的第一个字体定行高与基线，子集里没有空格，段落会随别的字体加载而上下微移。
        text = " " + "".join(b for b in blocks if all(ord(c) in has for c in b))
        table[slug], size = save(make_subset(load("xiaowei"), text), f"src/fonts/gua/{slug}.woff2")
        sizes.append(size)
    write_ranges(table, "src/fonts/gua/ranges.json")
    print("src/fonts/gua/", len(table), "pages, avg", sum(sizes) // len(sizes), "B")


def gua_hant() -> None:
    """繁体不整块换字体：芫荽缺的字从霞鹜文楷 TC 取。两款都缺就报错（换了原文或字体版本才会发生）。"""
    iansui, wenkai = cmap("iansui"), cmap("wenkai-tc")
    table, report = {}, []
    for slug, blocks in page_blocks("src/data/guaci-hant.json", "hant").items():
        chars = set("".join(blocks))
        missing = sorted(c for c in chars if ord(c) not in iansui)
        lost = [c for c in missing if ord(c) not in wenkai]
        if lost:
            raise SystemExit(f"{slug}：芫荽和霞鹜文楷 TC 都没有 {''.join(lost)}")
        text = " " + "".join(sorted(chars - set(missing)))
        table[slug], a = save(make_subset(load("iansui"), text), f"src/fonts/gua-hant/{slug}.woff2")
        b = 0
        if missing:
            table[f"{slug}-wk"], b = save(make_subset(load("wenkai-tc"), "".join(missing)), f"src/fonts/gua-hant/{slug}-wk.woff2")
        report.append((slug, a, b, "".join(missing)))
    write_ranges(table, "src/fonts/gua-hant/ranges.json")
    total = [a + b for _, a, b, _ in report]
    print("src/fonts/gua-hant/", len(report), "pages, avg", sum(total) // len(total), "B, max", max(total), "B")
    for slug, a, b, missing in report:
        if missing:
            print(f"  {slug}: {a} + {b} B（文楷补 {missing}）")


def fontsource_chars(pkg: str) -> set[int]:
    """fontsource 400 字重切片实际有的字：读 400.css 引用的每个文件的 cmap。"""
    base = f"node_modules/@fontsource/{pkg}"
    try:
        css = open(f"{base}/400.css", encoding="utf-8").read()
    except FileNotFoundError:
        raise SystemExit(f"找不到 {base}：先 pnpm install")
    has: set[int] = set()
    for f in re.findall(r"url\(\./files/([^)]+\.woff2)\)", css):
        has |= set(TTFont(f"{base}/files/{f}", lazy=True).getBestCmap())
    return has


def data_chars(files: list[str]) -> set[str]:
    text = ""
    for f in files:
        for v in json.load(open(f"src/data/{f}", encoding="utf-8")).values():
            text += "".join(v.values()) if isinstance(v, dict) else v
    return {c for c in text if not c.isspace()}


def face(family: str, wght: int, file: str, rng: str) -> str:
    return (
        "@font-face {\n"
        f"  font-family: '{family}';\n"
        "  font-style: normal;\n"
        f"  font-weight: {wght};\n"
        "  font-display: swap;\n"
        f"  src: url('../fonts/{file}.woff2') format('woff2');\n"
        f"  unicode-range: {rng};\n"
        "}"
    )


def paper_fonts() -> None:
    """卦页、目录页的正文补字与语言切换用字，写出 src/styles/paper-fonts.css。"""
    css = [
        "/* 生成文件，勿手改：tools/subset-fonts.py。卦页、目录页由 Paper.astro 引入，排在 fontsource 的声明之后，\n"
        "   这些字先用这里的小文件：正文补字是 fontsource 切片里没有的字，语言切换用字免得为一个字多下一整片。 */"
    ]
    for lang, (family, src, pkg, files) in BODY.items():
        have, full = fontsource_chars(pkg), cmap(src)
        missing = "".join(sorted(c for c in data_chars(files) if ord(c) not in have))
        lost = [c for c in missing if ord(c) not in full]
        if lost:
            raise SystemExit(f"{family} 完整字体也没有 {''.join(lost)}")
        path = f"src/fonts/body-{lang}.woff2"
        if not missing:
            if os.path.exists(path):
                os.remove(path)
            continue
        rng, size = save(make_subset(load(src), missing), path)
        css.append(face(family, 400, f"body-{lang}", rng))
        print(path, len(missing), "chars", size, "B:", missing)
    for wght in sorted({w for _, w in LANG}):
        text = "".join(t for (_, w), t in LANG.items() if w == wght)
        make_subset(load("serif-sc"), text, wght).save(f"src/fonts/lang-{wght}.woff2")
    for (family, wght), text in LANG.items():
        css.append(face(family, wght, f"lang-{wght}", ranges(text)))
    with open("src/styles/paper-fonts.css", "w", encoding="utf-8") as f:
        f.write("\n".join(css) + "\n")


def main() -> None:
    css = [
        "/* 生成文件，勿手改：tools/subset-fonts.py。首屏的字走这里的小文件，须在 fontsource 之后引入。 */"
    ]
    for key, (family, src) in HOME.items():
        font = make_subset(load(src), TEXT[key])
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

    paper_fonts()
    gua_hans()
    gua_hant()


if __name__ == "__main__":
    main()
