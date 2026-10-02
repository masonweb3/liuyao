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

黄历与节气（src/fonts/huangli/、huangli-hant/，同样的做法）：
- day：今日页和全部逐日页共用一份（七百多页各一份太多），含日期数字、农历月日、六十四卦名（读一卦），浏览别的日子不用再下。
- jieqi：二十四节气目录；每个节气页一份 {slug}：节气名与三候名。
- zeri：择日首页与全部事项月页共用一份（M18）：「择日」、六个事项名（从 src/lib/zeri-rule.ts 读）、「吉日」、公历日期。
改了 huangli.json、huangli-hant.json 的三候，zeri-rule.ts 的事项名，或这些页面上用标题字体的文案，就重跑。

梅花（/meihua/，M21）：暗场首屏同首页，另一组 meihua-display、meihua-body 与 src/styles/meihua-fonts.css（见 MEIHUA）。
起卦各屏、解读页的卦名卦辞随所起的卦而变，照首页走 fontsource 切片。

八字（src/fonts/bazi/、bazi-hant/）：排盘页 /bazi/（M19a）与全部知识页（M19b-3）共用一份 index，用标题字体的字是固定的一组：
「八字」、十天干、十二地支、0–9、乾造、坤造，知识页的「十神」「纳音」「十二长生」「十天干」「十二地支」，加纸面页都有的标题字。
简体的干支只剩天干、地支页 h1 的那一个字（盘面、表格、格子里的干支用宋体，见 BaziKb.astro），每个字各算一块：
「己」按小薇缺字处理，只有己页的 h1 用宋体，子集里不收它。

取名（src/fonts/quming/、quming-hant/，M22a）：测名页 /quming/ 与八十一数页共用一份 index，只有 h1「取名」「八十一数」加纸面页都有的
标题字。测名的输入框与结果用设备字体（M22-20），不进任何子集。

站酷小薇按缺字处理的字（gua_hans 整块不收）从 src/lib/gua.ts 的 NO_XIAOWEI 读，规则只写在那里；
它比 cmap 缺的字多一个「己」：小薇有这个码位，字形却和「巳」一样。

纸面页（卦页、目录、黄历与节气）的正文（宋体）另有补字，写进 src/styles/paper-fonts.css（Paper.astro 引入，排在 fontsource 之后）：
- src/fonts/body-hans.woff2、body-hant.woff2：fontsource 的 Noto Serif SC / TC 400 切片里没有、正文数据
  （卦爻辞全文、卦辞白话、爻辞白话、黄历释义与繁体名称表、择日的事项说明、八字的词语说明、知识页释义与繁体名称表、出生地名单；
  简体再加 tyme4ts 里的全部名称，宜忌、神煞都是它给的）
  却要用的字，从完整字体截出来，不让这些字回退到系统字体。缺哪些字按切片的
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
# 首屏的栏目导航：栏目表 src/data/columns.ts 里的简体栏目名。加了栏目就重跑。
COLUMNS = "".join(re.findall(r'hans: "(.+?)"', open("src/data/columns.ts", encoding="utf-8").read()))
TEXT = {
    # 竖排标语、印章
    "display": "心有所疑不妨一问爻",
    # 品牌、往卦、起卦、提示、手动排盘、桌面竖排小字、干支日期、栏目
    "body": "六爻往卦起一事问次摇手动排盘寂然不感而遂通" + GANZHI + COLUMNS + " ·　",
}

# 梅花页（/meihua/，M21）的首屏，同首页的做法：另一组小文件 src/fonts/meihua-{display,body}.woff2
# 与 src/styles/meihua-fonts.css，只由梅花页引入、预加载。改了梅花首屏的文案就重跑。
LUNAR = "正二三四五六七八九十冬腊闰初廿"
MEIHUA = {
    # 竖排标语「不动不占 / 不因事不占」、印章
    "display": "不动占因事爻",
    # 品牌、往卦、栏目、h1、起卦与提示、此刻的农历与时辰（北京时间）、跳到说明的链接
    "body": "六爻往卦梅花易数起卦一事问以时或数此刻（北京时间）怎样↓" + GANZHI + LUNAR + COLUMNS + " ·　",
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
    "hans": ("Noto Serif SC", "serif-sc", "noto-serif-sc", ["guaci.json", "baihua.json", "yao-baihua.json", "huangli.json", "zeri.json", "bazi.json", "bazi-tiangan.json", "bazi-dizhi.json", "bazi-pages.json", "quming.json", "quming-shuli.json"]),
    "hant": ("Noto Serif TC", "serif-tc", "noto-serif-tc", ["guaci-hant.json", "baihua-hant.json", "yao-baihua-hant.json", "huangli-hant.json", "zeri-hant.json", "bazi-hant.json", "bazi-tiangan-hant.json", "bazi-dizhi-hant.json", "bazi-pages-hant.json", "bazi-names-hant.json", "quming-hant.json", "quming-shuli-hant.json"]),
}

# 爻辞行：初九：… 六二：… 上六：… 用九：…
YAO = re.compile(r"^(初|上|用)?[六九][二三四五]?：")

# 站酷小薇按缺字处理的字：src/lib/gua.ts 的 fontOf 用的那张表（含 cmap 里有、字形画错的「己」）
NO_XIAOWEI = set(re.search(r"const NO_XIAOWEI = /\[(.+?)\]/", open("src/lib/gua.ts", encoding="utf-8").read()).group(1))

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


def make_subset(raw: bytes, text: str, wght: int = 400, lean: bool = False, drop: tuple[str, ...] = ()) -> TTFont:
    # 不写入当前时间，重跑结果逐字节相同，git 里不出现无谓的改动。
    font = TTFont(io.BytesIO(raw), recalcTimestamp=False)
    if "fvar" in font:
        # 名称表里仍写 ExtraLight（instancer 不改名），字形确是所给字重，不影响使用。
        font = instancer.instantiateVariableFont(font, {"wght": wght})
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]  # 竖排要用 vert / vrt2
    options.name_IDs = ["*"]  # OFL：版权与许可信息随字体走
    if lean:
        # 首屏子集（M21）：名称表只留版权、字体名、版本、商标与许可（OFL 要求的都在），不留可变字体各字重实例的名字，
        # 连同引用它们的 STAT 一起去掉。首页正文子集因此小了近 500 字节：加「梅」「花」两字后多出的 500 字节
        # 让 Lighthouse 模拟的首页 LCP 慢了一个往返（约 145 ms），去掉这些就回到原样。
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14]
        options.drop_tables += ["STAT"]
    options.drop_tables += list(drop)
    sub = subset.Subsetter(options)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = "woff2"
    return font


# 纸面页都有的标题字：页头印章、页底起卦块的标语。
CHROME = {"hans": "爻心有所疑，不妨一问", "hant": "爻心有所疑，不妨一問"}
# 黄历页用标题字体的日期：公历数字、农历月日（初一…三十、正月…腊月、闰月）
DATES = {"hans": "0123456789年月日正二三四五六七八九十冬腊闰初廿", "hant": "0123456789年月日正二三四五六七八九十冬臘閏初廿"}


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


def huangli_blocks(lang: str) -> dict[str, list[str]]:
    """黄历栏目各页用标题字体的文字，按区块分（同 page_blocks）：每个卦名、三候的每个候名各一块。"""
    hant = lang == "hant"
    data = json.load(open(f"src/data/huangli{'-hant' if hant else ''}.json", encoding="utf-8"))
    tw = data.get("names", {})
    guaci = json.load(open(f"src/data/guaci{'-hant' if hant else ''}.json", encoding="utf-8"))
    names = [v.split("\n")[0].split(" ")[2] for v in guaci.values()]
    terms = re.findall(r'\["(.+?)", "([a-z]+)"\]', open("src/lib/huangli-days.ts", encoding="utf-8").read())
    pages = {
        "day": [CHROME[lang], "農民曆" if hant else "黄历", DATES[lang], *names],
        "jieqi": [CHROME[lang], "二十四節氣" if hant else "二十四节气"],
    }
    for name, slug in terms:
        pages[slug] = [CHROME[lang], tw.get(name, name), *(h["name"] for h in data["jieqi"][name]["hou"])]
    # 择日（M18）：首页与全部事项月页共用一份（同 day）。标题「择日」、事项名（每个一块）、「吉日」、公历日期。
    items = re.findall(r'name: "(.+?)", hant: "(.+?)"', open("src/lib/zeri-rule.ts", encoding="utf-8").read())
    pages["zeri"] = [CHROME[lang], "擇日" if hant else "择日", *(i[1 if hant else 0] for i in items), "吉日", "0123456789年月日"]
    return pages


def bazi_blocks(lang: str) -> dict[str, list[str]]:
    """八字排盘页（M19a）与知识页（M19b-3，共用一份）用标题字体的字：h1、五行个数、乾造坤造，
    知识页的 h1（十神、纳音、十二长生、十天干、十二地支；天干、地支页的 h1 是一个干支字）。
    繁体的盘面与表格里的干支也用标题字体；简体那些干支用宋体，只有 h1 的单字要小薇。干支每个字各算一块
    （同 fontOf：己页的 h1 用宋体，别的字照收）。"""
    kb = ["十神", "納音", "十二長生"] if lang == "hant" else ["十神", "纳音", "十二长生"]
    return {"index": [CHROME[lang], "八字", *GANZHI[:22], "0123456789", "乾造坤造", *kb, "十天干", "十二地支"]}


def quming_blocks(lang: str) -> dict[str, list[str]]:
    """取名（M22a）：测名页与八十一数页共用一份，h1 各一块。"""
    return {"index": [CHROME[lang], "取名", "八十一數" if lang == "hant" else "八十一数"]}


def city_chars(lang: str) -> str:
    """出生地名单（src/data/cities.json）里本语言的城市名与所属：输入框和盘面上显示，用正文宋体。"""
    data = json.load(open("src/data/cities.json", encoding="utf-8"))
    k = 1 if lang == "hant" else 0
    return "".join(c[k] for c in data["cities"]) + "".join(r[k] for r in data["regions"])


def save(font: TTFont, path: str) -> tuple[str, int]:
    font.save(path)
    # 只写子集里真有的字：写了没有的字，浏览器会拿这个文件去找，又落回逐字回退。
    return ranges("".join(chr(c) for c in font.getBestCmap())), len(open(path, "rb").read())


def write_ranges(table: dict[str, str], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(table, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")


def gua_hans(pages: dict[str, list[str]], dir: str) -> None:
    """规则同 src/lib/gua.ts 的 fontOf：含小薇缺字的整块用宋体，不算在内。"""
    has = cmap("xiaowei")
    os.makedirs(dir, exist_ok=True)
    table, sizes = {}, []
    for slug, blocks in pages.items():
        # 空格：浏览器按含空格的第一个字体定行高与基线，子集里没有空格，段落会随别的字体加载而上下微移。
        text = " " + "".join(b for b in blocks if all(ord(c) in has and c not in NO_XIAOWEI for c in b))
        table[slug], size = save(make_subset(load("xiaowei"), text), f"{dir}/{slug}.woff2")
        sizes.append(size)
    write_ranges(table, f"{dir}/ranges.json")
    print(dir, len(table), "pages, avg", sum(sizes) // len(sizes), "B, max", max(sizes), "B")


def gua_hant(pages: dict[str, list[str]], dir: str) -> None:
    """繁体不整块换字体：芫荽缺的字从霞鹜文楷 TC 取。两款都缺就报错（换了原文或字体版本才会发生）。"""
    iansui, wenkai = cmap("iansui"), cmap("wenkai-tc")
    os.makedirs(dir, exist_ok=True)
    table, report = {}, []
    for slug, blocks in pages.items():
        chars = set("".join(blocks))
        missing = sorted(c for c in chars if ord(c) not in iansui)
        lost = [c for c in missing if ord(c) not in wenkai]
        if lost:
            raise SystemExit(f"{slug}：芫荽和霞鹜文楷 TC 都没有 {''.join(lost)}")
        text = " " + "".join(sorted(chars - set(missing)))
        table[slug], a = save(make_subset(load("iansui"), text), f"{dir}/{slug}.woff2")
        b = 0
        if missing:
            table[f"{slug}-wk"], b = save(make_subset(load("wenkai-tc"), "".join(missing)), f"{dir}/{slug}-wk.woff2")
        report.append((slug, a, b, "".join(missing)))
    write_ranges(table, f"{dir}/ranges.json")
    total = [a + b for _, a, b, _ in report]
    print(dir, len(report), "pages, avg", sum(total) // len(total), "B, max", max(total), "B")
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


def strings(v) -> list[str]:
    if isinstance(v, str):
        return [v]
    if isinstance(v, dict):
        v = list(v.values())
    return [s for x in v for s in strings(x)] if isinstance(v, list) else []


def tyme4ts_chars() -> str:
    """tyme4ts 里的全部汉字（宜忌、神煞、纳音、彭祖百忌……都是它给的，简体页照原样显示）。打包文件里写成 \\uXXXX。"""
    js = open("node_modules/tyme4ts/dist/lib/index.mjs", encoding="utf-8").read()
    return "".join(chr(int(h, 16)) for h in re.findall(r"\\u([0-9A-Fa-f]{4})", js)) + js


def data_chars(files: list[str], extra: str = "") -> set[str]:
    text = extra
    for f in files:
        text += "".join(strings(json.load(open(f"src/data/{f}", encoding="utf-8"))))
    # 只要汉字：tyme4ts 打包文件里的代码字符（ASCII）fontsource 本来就有
    return {c for c in text if not c.isspace() and ord(c) > 0x2E7F}


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
        extra = (tyme4ts_chars() if lang == "hans" else "") + city_chars(lang)
        missing = "".join(sorted(c for c in data_chars(files, extra) if ord(c) not in have))
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


def first_screen(name: str, text: dict[str, str], out: str) -> None:
    """首屏字形子集：src/fonts/{name}-{display,body}.woff2 与它们的 @font-face（out）。"""
    css = [
        "/* 生成文件，勿手改：tools/subset-fonts.py。首屏的字走这里的小文件，须在 fontsource 之后引入。 */"
    ]
    for key, (family, src) in HOME.items():
        # 正文子集再去掉 GSUB（aalt、fwid、hwid、pwid，浏览器默认都不开）、GPOS（kern、vpal）、BASE（M22）：栏目加「取名」后
        # home-body.woff2 从 9,852 涨到 10,140 字节，Lighthouse 模拟的首页 LCP 又慢了一个往返（约 130 ms，同 M21）；
        # 去掉这三张表是 9,856 字节，LCP 回到原样，首页首屏 390、1440 宽的截图与去掉之前逐像素相同。
        font = make_subset(load(src), text[key], lean=True, drop=("GSUB", "GPOS", "BASE") if key == "body" else ())
        path = f"src/fonts/{name}-{key}.woff2"
        font.save(path)
        css.append(
            "@font-face {\n"
            f"  font-family: '{family}';\n"
            "  font-style: normal;\n"
            "  font-weight: 400;\n"
            "  font-display: swap;\n"
            f"  src: url('../fonts/{name}-{key}.woff2') format('woff2');\n"
            f"  unicode-range: {ranges(text[key])};\n"
            "}"
        )
        print(path, len(set(text[key])), "chars")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(css) + "\n")


def main() -> None:
    first_screen("home", TEXT, "src/styles/fonts.css")
    first_screen("meihua", MEIHUA, "src/styles/meihua-fonts.css")
    paper_fonts()
    gua_hans(page_blocks("src/data/guaci.json", "hans"), "src/fonts/gua")
    gua_hant(page_blocks("src/data/guaci-hant.json", "hant"), "src/fonts/gua-hant")
    gua_hans(huangli_blocks("hans"), "src/fonts/huangli")
    gua_hant(huangli_blocks("hant"), "src/fonts/huangli-hant")
    gua_hans(bazi_blocks("hans"), "src/fonts/bazi")
    gua_hant(bazi_blocks("hant"), "src/fonts/bazi-hant")
    gua_hans(quming_blocks("hans"), "src/fonts/quming")
    gua_hant(quming_blocks("hant"), "src/fonts/quming-hant")


if __name__ == "__main__":
    main()
