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
  然后把 src/fonts/ 和 src/styles/fonts.css 拷回本机提交。
漏掉的字不会出错，只是回到 fontsource 的切片，慢一些。

卦页另外每页一份标题字体子集，按语言分组输出：
- 简体（/gua/…）：站酷小薇，src/fonts/gua/{slug}.woff2。页头、起卦块、卦名、卦辞、爻辞用小薇，一页要用到的字
  散在二十来片里（一百多万字节），打成一页一个小文件（平均十几 KB）预加载，首次渲染就是小薇，不再换字体。
- 繁体（/zh-hant/gua/…）：芫荽，src/fonts/gua-hant/{slug}.woff2；芫荽缺的生僻字从霞鹜文楷 TC 取，
  另成 {slug}-wk.woff2（本页没有缺字就不生成）。两款同出 Klee One，补上的字看不出差别。
每组一个 ranges.json（每个文件的 unicode-range，取自子集实际含有的字），卦页在自己的 <head> 里内联 @font-face。
改了 guaci.json、guaci-hant.json、gua-slugs.ts 或这些页面上用标题字体的文案，就重跑，把 src/fonts/ 一起拷回提交。

另有 src/fonts/hant-body-extra.woff2：Noto Serif TC 没有、繁体页正文却要显示的字（切换链接「简体」的「简」），
取 Noto Serif SC 的字形，webfonts-hant.css 里同名补上。

字体源文件不进 git：按下面固定的地址下载，核对 sha256，结果可复现。
"""
import hashlib
import io
import json
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

# 繁体页正文要显示、Noto Serif TC 却没有的字
HANT_BODY_EXTRA = "简"

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


# 卦页、目录页都有的标题字：页头印章、页底起卦块的标语。
CHROME = {"hans": "爻心有所疑，不妨一问", "hant": "爻心有所疑，不妨一問"}


def page_blocks(guaci_path: str, lang: str) -> dict[str, list[str]]:
    """每页用标题字体显示的文字，按区块分：卦名、卦辞各一块，全部爻辞算一块。"""
    slugs = re.findall(r'\["(.+?)", "([a-z-]+)"\]', open("src/data/gua-slugs.ts", encoding="utf-8").read())
    guaci = json.load(open(guaci_path, encoding="utf-8"))
    pages = {"index": [CHROME[lang], "六十四卦"]}  # 目录页的标题
    for name, slug in slugs:
        lines = guaci[name].split("\n")
        # 卦名取首行（繁体是原文写法：天山遯）；简体首行的全名就是键。
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

    make_subset(load("serif-sc"), HANT_BODY_EXTRA).save("src/fonts/hant-body-extra.woff2")
    gua_hans()
    gua_hant()


if __name__ == "__main__":
    main()
