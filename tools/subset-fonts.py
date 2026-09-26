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
  然后把 src/fonts/home-*.woff2 和 src/styles/fonts.css 拷回本机提交。
漏掉的字不会出错，只是回到 fontsource 的切片，慢一些。
"""
import io
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


def ranges(chars: str) -> str:
    return ", ".join(f"U+{ord(c):04X}" for c in sorted(set(chars)))


def main() -> None:
    css = [
        "/* 生成文件，勿手改：tools/subset-fonts.py。首屏的字走这里的小文件，须在 fontsource 之后引入。 */"
    ]
    for key, (family, url) in FONTS.items():
        # 不写入当前时间，重跑结果逐字节相同，git 里不出现无谓的改动。
        font = TTFont(io.BytesIO(urllib.request.urlopen(url).read()), recalcTimestamp=False)
        if "fvar" in font:
            # 名称表里仍写 ExtraLight（instancer 不改名），字形确是 400，不影响使用。
            font = instancer.instantiateVariableFont(font, {"wght": 400})
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]  # 竖排要用 vert / vrt2
        options.name_IDs = ["*"]  # OFL：版权与许可信息随字体走
        sub = subset.Subsetter(options)
        sub.populate(text=TEXT[key])
        sub.subset(font)
        path = f"src/fonts/home-{key}.woff2"
        font.flavor = "woff2"
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


if __name__ == "__main__":
    main()
