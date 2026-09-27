"""
由维基文库《周易》各卦子页生成 src/data/guaci-hant.json（繁体原文），结构与 guaci.json 逐行对应。

底本：各页在 2026-07-26（najia 取数、生成 guaci.json 的那天）的修订版本，修订号写死在 PAGES 里，
所以重跑的结果不随维基文库之后的编辑变化（2026-09-27 就有 35 页被人改过，如屯卦初九加了异文注）。
解析规则照 najia 的 tools/build-guaci.py（commit 108d13a）：删去异文夹注，否卦爻题后的逗号改冒号，
坤卦分三行的卦辞并为一行；只是不做繁转简，「无」「于」等用字照原文。改正的讹误见 CORRECTIONS，
每一条都要在 NOTICE 登记。首行不是维基文库的文字，由卦序、卦名（维基文库的页名，只有 NAMES 里的两个换写法）和页首的
「坤下坎上」拼成。

写出后，用 najia 的同一个函数把结果转回简体，与 guaci.json 逐行比对：除了 EXPECTED 里的已知差异，
有任何不同就报错。这一步证明底本和解析都和 guaci.json 一致。

要修讹误：在 CORRECTIONS 加一条（繁体写法），重跑，在 NOTICE 登记。在测试服务器上跑，不在本机：
  ssh $STAGE 'cd ~/liuyao && docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v ~/liuyao:/app -w /app \
    python:3.12-slim sh -c "pip install -q --user opencc-python-reimplemented && python tools/build-guaci-hant.py"'
  然后把 src/data/guaci-hant.json 拷回本机提交；卦爻辞的字变了，还要重跑 tools/subset-fonts.py。
只发两次请求（按修订号一次取 32 页）。
"""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from opencc import OpenCC

API = "https://zh.wikisource.org/w/api.php"
UA = "sixyao-build/1.0 (https://sixyao.app; tools/build-guaci-hant.py, two requests per run)"

# 卦序 1–64 的维基文库子页名（「周易/乾」）与底本修订号
PAGES = [
    ("乾", 2404991), ("坤", 2404999), ("屯", 2527353), ("蒙", 2601829), ("需", 2405039), ("訟", 2405032),
    ("師", 2405011), ("比", 2405022), ("小畜", 2405006), ("履", 2494097), ("泰", 2106138), ("否", 2106139),
    ("同人", 2106140), ("大有", 2494004), ("謙", 2106142), ("豫", 2106143), ("隨", 2497157), ("蠱", 2106145),
    ("臨", 2106146), ("觀", 2106147), ("噬嗑", 2404997), ("賁", 2405035), ("剝", 2404994), ("復", 2497162),
    ("无妄", 2527352), ("大畜", 2405001), ("頤", 2405042), ("大過", 2405002), ("坎", 2502716), ("離", 2528049),
    ("咸", 2404996), ("恒", 2530043), ("遯", 2405037), ("大壯", 2531745), ("晉", 2584802), ("明夷", 2531747),
    ("家人", 2405005), ("睽", 2531978), ("蹇", 2405036), ("解", 2405031), ("損", 2405014), ("益", 2405025),
    ("夬", 2405003), ("姤", 2437487), ("萃", 2535017), ("升", 2404995), ("困", 2502714), ("井", 2404992),
    ("革", 2674393), ("鼎", 2106200), ("震", 2560429), ("艮", 2405028), ("漸", 2560535), ("歸妹", 2511521),
    ("豐", 2560608), ("旅", 2560781), ("巽", 2441563), ("兌", 2404993), ("渙", 2405023), ("節", 2405027),
    ("中孚", 2404990), ("小過", 2405007), ("既濟", 2572417), ("未濟", 2405020),
]

# 对维基文库转录本身的改正，按卦序，繁体写法。
CORRECTIONS = {
    # 与 najia 相同的两处（地雷復）
    24: [("不復遠", "不遠復"), ("无袛悔", "无祗悔")],
    # 原文混入的简化字（不在 Big5，繁体字体可能没有）：坎六四小象；豐上六（困初六同句作「覿」）
    29: [("剛柔济也", "剛柔濟也")],
    55: [("三歲不觌", "三歲不覿")],
}

# 首行卦名换成台湾常见写法：台湾读者和搜索都写「無妄」「恆」，维基文库页名作「无妄」「恒」。只换首行
# （卦页的卦名、标题、目录由它而来），经文照原文。遯是台湾常见写法，不换。转回简体后与 guaci.json 相同。
NAMES = {"无妄": "無妄", "恒": "恆"}

# 转回简体后允许与 guaci.json 不同的行：遯卦全名照原文作「天山遯」，guaci.json 作「天山遁」
EXPECTED = {("天山遁", 0)}

YAO_LABEL = r"(初[六九]|[六九][二三四五]|上[六九]|用[九六])"
YAO = re.compile(rf"^{YAO_LABEL}[：，]")
YAO_COMMA = re.compile(rf"^({YAO_LABEL})，")
SECTIONS = {"易經": "jing", "彖曰": "tuan", "象曰": "xiang"}
STOP = ("文言曰",)  # 文言传不收
GLOSS = re.compile(r"〈[^〉]{0,30}〉")  # 异文夹注，如「保合大和〈一作太和〉」

# 首行用字：简体首行的卦象、八卦名换成繁体
IMAGE = {"天": "天", "地": "地", "雷": "雷", "风": "風", "水": "水", "火": "火", "山": "山", "泽": "澤"}
TRIGRAMS = set("乾坤震巽坎離艮兌")


def get(params: dict) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2", "maxlag": "5"})
    for _ in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            data = json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
            if "error" in data:
                raise SystemExit(data["error"])
            return data
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(max(int(e.headers.get("Retry-After") or 60), 30))
    raise SystemExit("维基文库一直返回 429，稍后再跑")


def fetch() -> dict[int, tuple[str, str]]:
    """{卦序: (页名, wikitext)}"""
    by_rev = {rev: (n, title) for n, (title, rev) in enumerate(PAGES, 1)}
    out = {}
    revs = list(by_rev)
    for chunk in (revs[:32], revs[32:]):
        data = get({"action": "query", "prop": "revisions", "revids": "|".join(map(str, chunk)),
                    "rvprop": "ids|content", "rvslots": "main"})
        for page in data["query"]["pages"]:
            for r in page["revisions"]:
                n, title = by_rev[r["revid"]]
                if page["title"] != f"周易/{title}":
                    raise SystemExit(f"修订 {r['revid']} 属于 {page['title']}，不是 周易/{title}")
                out[n] = (title, r["slots"]["main"]["content"])
        time.sleep(3)
    if len(out) != 64:
        raise SystemExit(f"只取到 {len(out)} 页")
    return out


def clean(line: str) -> str:
    """wikitext 一行 → 纯文字：去列表符号、粗体、繁简转换标记、图片、链接；{{*|注}} 变成〈注〉再删。"""
    line = re.sub(r"^[*#:;]+", "", line)
    line = line.replace("'''", "")
    line = re.sub(r"-\{T\|[^}]*\}-", "", line)
    line = re.sub(r"-\{([^{}|;:]*)\}-", r"\1", line)
    line = re.sub(r"\{\{\*\|([^}]*)\}\}", r"〈\1〉", line)
    line = re.sub(r"\[\[(?:File|Image|檔案|文件):[^\]]*\]\]", "", line)
    return re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", line)


def parse_page(lines: list[str]) -> dict[str, list[str]]:
    section = None
    out: dict[str, list[str]] = {"jing": [], "tuan": [], "xiang": []}
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith(STOP):
            break
        line = GLOSS.sub("", line)
        head = line.rstrip("：")
        if head in SECTIONS:
            section = SECTIONS[head]
            continue
        if section:
            if re.search(r"[{}\[\]<>|=']|-\{|\}-", line):
                raise SystemExit(f"没认出来的 wiki 标记：{line}")
            out[section].append(line)
    return out


def cn2int(s: str) -> int:
    d = "〇一二三四五六七八九"
    if "十" not in s:
        return d.index(s)
    a, b = s.split("十")
    return (d.index(a) if a else 1) * 10 + (d.index(b) if b else 0)


t2s = OpenCC("t2s")


def to_simplified(text: str) -> str:
    """najia 的原函数：逐字转，乾不转，不转成扩展区的字。"""
    out = []
    for ch in text:
        c = ch if ch == "乾" else t2s.convert(ch)
        out.append(ch if len(c) == 1 and ord(ch) <= 0xFFFF and ord(c) > 0xFFFF else c)
    return "".join(out)


def main() -> None:
    pages = fetch()
    simp = json.load(open("src/data/guaci.json", encoding="utf-8"))
    built, diffs = {}, []
    for name, stext in simp.items():
        no, _, sfull, _ = stext.split("\n")[0].replace("《易经》", "").split(" ")
        n = cn2int(no[1:-1])
        page, wikitext = pages[n]
        short = NAMES.get(page, page)
        lines = [clean(l) for l in re.sub(r"</?span[^>]*>", "", wikitext).split("\n")]
        heads = [l.strip() for l in lines if re.fullmatch(r"\s*(.)下(.)上\s*", l)]
        if len(heads) != 1 or not {heads[0][0], heads[0][2]} <= TRIGRAMS:
            raise SystemExit(f"{name}：页首的「X下Y上」认不出来：{heads}")
        lower, upper = heads[0][0], heads[0][2]
        full = f"{short}為{IMAGE[sfull[2]]}" if sfull[1] == "为" else IMAGE[sfull[0]] + IMAGE[sfull[1]] + short

        parsed = parse_page(lines)
        jing, xiang = parsed["jing"], parsed["xiang"]
        yaoci = [YAO_COMMA.sub(r"\1：", l) for l in jing if YAO.match(l)]
        if len(yaoci) != len(xiang) - 1:
            raise SystemExit(f"{name}：爻辞 {len(yaoci)} 条，小象 {len(xiang) - 1} 条，对不上")
        body = ["".join(l for l in jing if not YAO.match(l)), f"彖曰：{''.join(parsed['tuan'])}", f"象曰：{xiang[0]}", ""]
        for yao, xiao in zip(yaoci, xiang[1:]):
            body += [yao, f"象曰：{xiao}"]
        text = "\n".join([f"《易經》{no} {short} {full} {upper}上{lower}下", *body])
        for wrong, right in CORRECTIONS.get(n, []):
            if wrong not in text:
                raise SystemExit(f"{name}：要改的「{wrong}」不在了，复核 CORRECTIONS")
            text = text.replace(wrong, right)
        built[name] = text

        back = to_simplified(text).split("\n")
        if len(back) != len(stext.split("\n")):
            diffs.append(f"{name}：行数不同")
        for i, (a, b) in enumerate(zip(stext.split("\n"), back)):
            if a != b and (name, i) not in EXPECTED:
                diffs.append(f"{name} 第 {i} 行\n  guaci.json {a}\n  转回简体   {b}")

    if diffs:
        raise SystemExit("转回简体后与 guaci.json 不同：\n" + "\n".join(diffs))
    with open("src/data/guaci-hant.json", "w", encoding="utf-8") as f:
        json.dump(built, f, ensure_ascii=False, indent="\t")
        f.write("\n")
    print("src/data/guaci-hant.json：64 卦，转回简体与 guaci.json 一致")


if __name__ == "__main__":
    main()
