"""
测名（M22a）的字表：生成 src/data/quming-zi.json。/quming/ 的页面在第一次点进姓、名输入框时整份下载（不按字取：按字或按码位
分片下载，请求日志就会泄露名字里的字），之后的计算全在浏览器里查表，不再发任何请求。

数据来源（固定版本，下载后核对 sha256，结果可复现）：
- Unicode Unihan Database 18.0.0（Unicode License v3，https://www.unicode.org/license.txt）：字形、繁简、Big5、部首余笔、
  《康熙字典》页码、普通话与粤语读音、异体。用到的字段：kTGH、kRSUnicode、kTotalStrokes、kTraditionalVariant、
  kSimplifiedVariant、kBigFive、kKangXi、kTGHZ2013、kMandarin、kCantonese、kSemanticVariant、kZVariant、
  kSpecializedSemanticVariant。CJKRadicals.txt 给部首号对应的部首本字。
- List of Dirty, Naughty, Obscene, and Otherwise Bad Words 的英文表（© 2012–2020 Shutterstock, Inc.，CC BY 4.0）：
  只取不带空格、三个字母以上的单词条目，去掉 DROP 里的；另加本站自建的 SELF。
- 本站写定（读音、拼法是事实，不抄字典条目）：名字常用字形 NAME_FORM（M22-21）、姓氏读音 SURNAME（调研 §3.2）、
  复姓 COMPOUND（M22-25）、港式姓氏写法 HK（M22-14）、谐音放行 PASS（M22-30）。
- 康熙笔画的例外表与已核字形：tools/quming-kangxi.json（看同文书局本影印写成，M22-1 A1）。

康熙笔画的算法（调研 strokes-check.md §5）：繁体字形（只留 kBigFive 的）→ kRSUnicode（多个值时取部首在该字 kKangXi
页码范围里的那个）→ 部首本字的笔画 + 部外画；例外表优先。数字一到十按数值、王 记 4 两条约定在 src/lib/quming.ts。
被书序检查标出（前后邻居与它的部首、画数对不上，部首字本身，原书正文没收，或 kRSUnicode 有多个值）、又不在已核字形里的，
标成「未逐字核对原书」。

在测试服务器上跑（不在本机）：
  ssh $STAGE 'cd ~/liuyao && docker run --rm --user $(id -u):$(id -g) -v ~/liuyao:/app -w /app python:3.12-slim \
    python tools/build-quming.py'
然后把 src/data/quming-zi.json 拷回本机提交。改了 tools/quming-kangxi.json 或这里的表就重跑。
"""
import gzip
import hashlib
import io
import json
import re
import urllib.request
import zipfile

SOURCES = {
    "unihan": ("https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip", "4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e"),
    "radicals": ("https://www.unicode.org/Public/18.0.0/ucd/CJKRadicals.txt", "689e2e5852699e7115823dc0b6d3e615eb767c7f477b615678f4f989d1f06105"),
    "ldnoobw": (
        "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/5faf2ba42d7b1c0977169ec3611df25a3c08eb13/en",
        "af851ecef1d5f212caba17339b12ac39cc2fef7d78c74876f67237644fcee8bd",
    ),
}

FIELDS = {"kTGH", "kRSUnicode", "kTotalStrokes", "kTraditionalVariant", "kSimplifiedVariant", "kBigFive", "kKangXi",
          "kTGHZ2013", "kMandarin", "kCantonese", "kSemanticVariant", "kZVariant", "kSpecializedSemanticVariant"}

# 一简多繁时名字里默认用的字形（M22-21）：只写默认不是码位最小的那个的。其余照 kTraditionalVariant 的次序（码位）。
NAME_FORM = (
    "家家 云雲 苏蘇 范范 宁寧 万萬 庄莊 丰豐 怀懷 谷谷 涂涂 儿兒 致致 复復 蒙蒙 采采 里里 栗栗 苹蘋 筑築 适適 体體 机機 准準 "
    "历歷 当當 优優 极極 怜憐 愿願 栖棲 腊臘 气氣 荐薦 种種 尽盡 厘釐 淀澱 价價 伙夥 系系 仆僕 厂廠 听聽 赶趕 么麼 晒曬 舍舍 "
    "佣傭 构構 虫蟲 确確 药藥 篱籬 肮骯 蚕蠶 柜櫃 坏壞 痒癢 扑撲 蜡蠟 卤鹵 恶惡 据據 踊踴 洼窪 划劃 夸誇 挂掛 荡蕩 几幾 洒灑 "
    "帘簾 纤纖"
)

# 多音的姓：作姓的读音（普通话，粤拼；粤拼写 None 的照 kCantonese）。只列 kMandarin 的第一个读音、kCantonese 不是姓氏读法的，
# 和几个复姓里读法特殊的字。读音是事实：普通话读音都核对过在该字的 kTGHZ2013 里（下面断言）。
SURNAME = {
    "曾": [("zēng", None)], "任": [("rén", "jam4")], "肖": [("xiāo", None)], "葛": [("gě", None)], "纪": [("jǐ", None)],
    "华": [("huà", "waa6")], "翟": [("zhái", "zaak6")], "单": [("shàn", "sin6")], "宁": [("nìng", None)], "区": [("ōu", "au1")],
    "覃": [("qín", None)], "乐": [("yuè", None)], "卜": [("bǔ", "buk1")], "缪": [("miào", "miu6")], "查": [("zhā", "zaa1")],
    "应": [("yīng", "jing1")], "解": [("xiè", "haai6")], "仇": [("qiú", "kau4")], "朴": [("piáo", None)], "盖": [("gě", None)],
    "秘": [("bì", None)], "召": [("shào", None)], "繁": [("pó", None)], "过": [("guō", None)], "都": [("dū", None)],
    "种": [("chóng", None)], "燕": [("yān", None)], "角": [("jué", None)], "便": [("pián", None)], "朝": [("cháo", None)],
    "员": [("yùn", None)], "句": [("gōu", None)], "尉": [("wèi", None)],
    "尉迟": [("yù", "wat1"), ("chí", None)], "万俟": [("mò", None), ("qí", None)], "长孙": [("zhǎng", "zoeng2"), ("sūn", None)],
    "单于": [("chán", None), ("yú", None)], "澹台": [("tán", None), ("tái", None)], "令狐": [("líng", None), ("hú", None)],
}

# 复姓（简体）：姓一格只写了一个字、而它和名的首字合起来是这里的复姓时，结果上方提示「改成复姓」（M22-25），不自动拆。
COMPOUND = (
    "欧阳 司马 上官 诸葛 东方 皇甫 尉迟 公孙 慕容 长孙 宇文 司徒 夏侯 轩辕 令狐 钟离 端木 西门 南宫 独孤 呼延 澹台 万俟 "
    "闻人 申屠 赫连 濮阳 公冶 太史 拓跋 鲜于 闾丘 单于 司空 东郭 第五"
).split()

# 港式（香港证件常见）的姓氏写法，键是简体（M22-14）。只列常见的写法；名字的写法因人而异，不列。两个词的写法用 _ 连（Au_Yeung）。
HK = {k: v.replace("_", " ") for k, v in (x.split(":") for x in (
    "陈:Chan 李:Lee 张:Cheung 黄:Wong 王:Wong 林:Lam 刘:Lau 吴:Ng 梁:Leung 何:Ho 郭:Kwok 郑:Cheng 罗:Law 麦:Mak 谢:Tse "
    "余:Yu 蔡:Choi 叶:Yip 邓:Tang 曾:Tsang 杨:Yeung 周:Chow 冯:Fung 朱:Chu 胡:Wu 莫:Mok 许:Hui 卢:Lo 苏:So 潘:Poon 钟:Chung "
    "袁:Yuen 方:Fong 江:Kong 石:Shek 谭:Tam 杜:To 范:Fan 孙:Suen 徐:Tsui 陆:Luk 姚:Yiu 廖:Liu 邹:Chau 唐:Tong 宋:Sung "
    "戴:Tai 韩:Hon 薛:Sit 雷:Lui 侯:Hau 邱:Yau 丘:Yau 文:Man 欧:Au 区:Au 施:Sze 单:Sin 冼:Sin 岑:Shum 沈:Shum 程:Ching "
    "傅:Fu 甘:Kam 金:Kam 严:Yim 顾:Koo 龚:Kung 黎:Lai 赖:Lai 吕:Lui 魏:Ngai 伍:Ng 熊:Hung 洪:Hung 孔:Hung 简:Kan 关:Kwan "
    "高:Ko 崔:Tsui 邝:Kwong 尹:Wan 温:Wan 韦:Wai 卫:Wai 卓:Cheuk 康:Hong 汤:Tong 彭:Pang 马:Ma 毛:Mo 聂:Nip 倪:Ngai "
    "包:Pau 鲍:Pau 毕:Pat 邵:Shiu 萧:Siu 孟:Mang 祝:Chuk 庄:Chong 纪:Kei 钱:Chin 秦:Chun 田:Tin 易:Yik 殷:Yan 游:Yau "
    "俞:Yu 阮:Yuen 翁:Yung 容:Yung 戚:Chik 夏:Ha 霍:Fok 樊:Fan 葛:Kot 古:Koo 贺:Ho 姜:Keung 焦:Chiu 柯:Or 蓝:Lam 凌:Ling "
    "柳:Lau 龙:Lung 骆:Lok 梅:Mui 庞:Pong 任:Yam 史:Sze 陶:To 童:Tung 汪:Wong 向:Heung 颜:Ngan 岳:Ngok 詹:Chim 章:Cheung "
    "赵:Chiu 甄:Yan 白:Pak 安:On 董:Tung 连:Lin 车:Che 欧阳:Au_Yeung 司徒:Szeto 上官:Sheung_Kwun 司马:Sze_Ma"
).split())}

# 英文不雅词：LDNOOBW 的单词条目里去掉的（几乎没人认得、只会误报的：guro 撞上 Gurong，yaoi 撞上威妥玛的 Yao I-）
# 与本站自建的「读音像」（M22-13、M22-30）。自建表拿 Wikidata 71,442 个名字试过：fuc（Fuchun、Fucheng）、suk（粤拼 淑 suk6、
# 威妥玛 Su K'ai）、kunt（K'unt'ing）、bich（Bichun）、shag（Shagang）、shat（Shatao）几乎全是误报，不收；
# dong、wang 会撞上 东、王 这样最常见的字，也不收。
DROP = {"guro", "yaoi"}
SELF = "fuk dik kok chink homo nazi pusi".split()
# 放行：只在它正好是一个完整音节时不算（粤拼 mong 望、tit 铁）
PASS = ["mong", "tit"]

NUM = "一二三四五六七八九十"
# 部首笔画：部首号从哪里起是几画（同 docs/review-m22/scripts/uh.py；114 禸 按康熙的分组记 5）
STEPS = [(1, 1), (7, 2), (30, 3), (61, 4), (95, 5), (118, 6), (147, 7), (167, 8), (176, 9), (187, 10), (195, 11), (201, 12), (205, 13), (209, 14), (211, 15), (212, 16), (214, 17)]


def rad_strokes(r: int) -> int:
    return max(n for start, n in STEPS if r >= start)


def fetch(key: str) -> bytes:
    url, sha = SOURCES[key]
    data = urllib.request.urlopen(url).read()
    if hashlib.sha256(data).hexdigest() != sha:
        raise SystemExit(f"{key} 的 sha256 对不上：{url}")
    return data


def load_unihan() -> dict[str, dict[str, str]]:
    u: dict[str, dict[str, str]] = {}
    with zipfile.ZipFile(io.BytesIO(fetch("unihan"))) as z:
        for name in z.namelist():
            for line in z.read(name).decode("utf-8").splitlines():
                if line.startswith("#") or not line.strip():
                    continue
                cp, k, v = line.split("\t", 2)
                if k in FIELDS:
                    u.setdefault(chr(int(cp[2:], 16)), {})[k] = v
    return u


def cps(v: str) -> list[str]:
    return [chr(int(x[2:].split("<")[0], 16)) for x in v.split()] if v else []


def rs_values(v: str) -> list[tuple[int, int]]:
    return [(int(a), int(c)) for a, _, c in re.findall(r"(\d+)('*)\.(-?\d+)", v)]


def main() -> None:
    u = load_unihan()
    RAD = {}
    for line in fetch("radicals").decode("utf-8").splitlines():
        if line.startswith("#") or not line.strip():
            continue
        a, _, c = [x.strip() for x in line.split(";")]
        if a.isdigit():
            RAD[int(a)] = chr(int(c, 16))
    assert len(RAD) == 214
    kx_file = json.load(open("tools/quming-kangxi.json", encoding="utf-8"))
    EXC = {k: tuple(v) for k, v in kx_file["exceptions"].items()}
    CHECKED = set(kx_file["checked"]) | set(EXC)

    tgh = {c: int(d["kTGH"].split(":")[1]) for c, d in u.items() if "kTGH" in d}
    assert len(tgh) == 8105
    order = sorted(tgh, key=tgh.get)
    big5 = {c for c, d in u.items() if "kBigFive" in d}

    def trads(c: str) -> list[str]:
        return cps(u[c].get("kTraditionalVariant", "")) or [c]

    names = dict(NAME_FORM.split())

    def forms(c: str) -> list[str]:
        f = [t for t in trads(c) if t in big5] or trads(c)
        if c in names:
            assert names[c] in f, (c, f)
            f = [names[c]] + [x for x in f if x != names[c]]
        return f

    # 部首的页码范围（只用 kRSUnicode 单值、在正文里的字算，免得多值字自己把范围撑大）
    rng: dict[int, tuple[float, float]] = {}
    rows = []
    for c, d in u.items():
        if "kKangXi" in d and "kRSUnicode" in d:
            pos = d["kKangXi"].split()[0]
            p = float(pos)
            if pos.endswith("0") and 75 <= p < 1595:
                rs = rs_values(d["kRSUnicode"])
                rows.append((p, rs[0], c))
                if len(rs) == 1:
                    lo, hi = rng.get(rs[0][0], (9999, 0))
                    rng[rs[0][0]] = (min(lo, p), max(hi, p))
    rows.sort()
    # 书序检查：前后邻居与它同部同画的是 inside，在两段交界的是 edge，其余被标出（调研 worklists.py）
    cls = {}
    for i, (p, k, c) in enumerate(rows):
        pv = rows[i - 1][1] if i else None
        nx = rows[i + 1][1] if i + 1 < len(rows) else None
        cls[c] = "inside" if pv == k == nx else "differs" if pv == nx else ("edge" if k in (pv, nx) else ("radhead" if k[1] <= 0 else "odd"))

    def rs_pick(t: str) -> tuple[int, int]:
        vals = rs_values(u[t]["kRSUnicode"])
        if len(vals) > 1 and "kKangXi" in u[t]:
            p = float(u[t]["kKangXi"].split()[0])
            for v in vals:
                lo, hi = rng.get(v[0], (0, 0))
                if lo - 1 <= p <= hi + 1:
                    return v
        return vals[0]

    def flagged(t: str) -> bool:
        return cls.get(t) in ("differs", "odd", "radhead") or len(rs_values(u[t]["kRSUnicode"])) > 1 or t not in cls

    def cantonese(*cs: str) -> str:
        for c in cs:
            v = u.get(c, {}).get("kCantonese")
            if v:
                return v.split()[0]
        return ""

    # ---------- 繁体字形与康熙笔画 ----------
    t_map = {c: "".join(forms(c)) for c in order if forms(c) != [c]}
    simp = {}
    for c in order:
        for f in forms(c):
            if f not in tgh:
                simp.setdefault(f, c)
    kx_keys = sorted(big5 | {f for c in tgh for f in forms(c)})
    kx = {}
    for t in kx_keys:
        r, res = EXC[t][:2] if t in EXC else rs_pick(t)
        today = int(u[t]["kTotalStrokes"].split()[0])
        convention = t in NUM or t == "王"
        # 今写笔画与康熙笔画相同时省掉（浏览器里按部首笔画加部外画补回）
        kx[t] = [r, res, "" if today == rad_strokes(r) + res else today] + ([1] if flagged(t) and t not in CHECKED and not convention else [])
    x = {t: EXC[t][2] for t in sorted(EXC)}
    assert all(t in kx for t in EXC), [t for t in EXC if t not in kx]

    # ---------- 读音：规范字表的字用 kTGHZ2013 全部读音，默认（kMandarin 第一个）排前；台湾读音（kMandarin 第二个）不同时另记 ----------
    def reading(c: str) -> list[str]:
        km = u[c].get("kMandarin", "").split()
        all_ = list(dict.fromkeys(v.split(":")[1] for v in u[c].get("kTGHZ2013", "").split())) or list(dict.fromkeys(km))
        if not all_:
            return []
        first = km[0] if km and km[0] in all_ else all_[0]
        all_ = [first] + [v for v in all_ if v != first]
        tw = km[1] if len(km) > 1 else first
        if tw not in all_:
            all_.append(tw)
        out = [" ".join(all_), cantonese(c)]
        return out + [tw] if tw != first else out

    # 每个字一条，分号隔开：康熙笔画（部首号.部外画.今写笔画[.1 未核]）;读音（默认在前，空格隔开）;粤拼;台湾读音（与默认不同时）;
    # Big5 字形（规范字表的字有别的字形时，名字里默认的在前）。末尾的空栏省掉。繁体字形的读音跟它的规范字，不另记。
    # g 是《通用规范汉字表》8105 字（按表里的序号排，浏览器按这个次序反查繁体字形的规范字），z 是表外的 Big5 字与繁体字形。
    def record(c: str) -> str:
        k = ".".join(map(str, kx[c])) if c in kx else ""
        rd = reading(c) if c in tgh or c not in simp else []
        f = t_map.get(c, "")
        fields = [k, *(rd + [""] * (3 - len(rd))), f]
        return ";".join(fields).rstrip(";")

    g_map = {c: record(c) for c in order}
    z_map = {c: record(c) for c in sorted(set(kx) - set(tgh))}

    # ---------- 字表外的字：Unihan 记的异体在字表里的，问一句能不能按它算（M22-24） ----------
    table = set(tgh) | big5 | set(kx)
    v_map = {}
    for c in sorted(u):
        o = ord(c)
        if c in table or not (0x3400 <= o <= 0x4DBF or 0x4E00 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF):
            continue
        for k in ("kSemanticVariant", "kZVariant", "kSpecializedSemanticVariant", "kSimplifiedVariant", "kTraditionalVariant"):
            cand = [y for y in cps(u[c].get(k, "")) if y in table]
            if cand:
                v_map[c] = cand[0]
                break

    # ---------- 姓氏读音、复姓、港式 ----------
    def tghz(c: str) -> list[str]:
        return [v.split(":")[1] for v in u[c].get("kTGHZ2013", "").split()]

    for s, rs in SURNAME.items():
        assert len(s) == len(rs), s
        for ch, (py, _) in zip(s, rs):
            assert ch in tgh and py in tghz(ch), (s, ch, py, tghz(ch))
    for s in list(COMPOUND) + list(HK):
        assert all(ch in tgh for ch in s), s
    sur = {s: [[py, jp] for py, jp in rs] for s, rs in SURNAME.items()}

    words = [w.strip() for w in fetch("ldnoobw").decode("utf-8").splitlines()]
    bad = sorted({w for w in words if " " not in w and len(w) >= 3 and w.isalpha() and w not in DROP} | set(SELF))

    out = {
        "license": "Unicode Unihan Database 18.0.0, Copyright © 1991-2026 Unicode, Inc., Unicode License v3 (https://www.unicode.org/license.txt), "
                   "converted and corrected by sixyao.app; bad: List of Dirty, Naughty, Obscene, and Otherwise Bad Words (en), "
                   "© 2012-2020 Shutterstock, Inc., CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), single words only, with additions.",
        "rad": "".join(RAD[i] for i in range(1, 215)),
        "g": g_map,
        "z": z_map,
        "x": x,
        "v": v_map,
        "sur": sur,
        "fu": COMPOUND,
        "hk": HK,
        "bad": bad,
        "pass": PASS,
    }
    raw = json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    open("src/data/quming-zi.json", "wb").write(raw + b"\n")
    print("g", len(g_map), "z", len(z_map), "forms", len(t_map), "v", len(v_map), "bad", len(bad),
          "flagged-unchecked", sum(1 for v in kx.values() if len(v) > 3))
    for c in "林雨涵施涛濤欧歐陽静靜王琳单單乐樂叶葉云雲陳怡珮李峰曹成節":
        print(c, (g_map | z_map).get(c))
    print("raw", len(raw), "gzip -9", len(gzip.compress(raw, 9)))
    try:
        import brotli
        print("brotli", len(brotli.compress(raw, quality=11)))
    except ImportError:
        pass


if __name__ == "__main__":
    main()
