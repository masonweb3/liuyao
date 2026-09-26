/**
 * 卦页 —— 六十四卦的网址、卦名字体和卦爻辞拆分。零 DOM，也不引数据文件：
 * sitemap、卦页、解读页链接、分享卡都从这里取，各处打包时只带走用到的部分。
 */

/**
 * 通行本卦序（第一卦乾到第六十四卦未济）的卦全名与网址 slug。
 *
 * slug 一经上线就不能改（外链、收录都指向它）。规则：
 * - 卦全名的拼音，逐字用连字符隔开，不带声调：地山谦 → di-shan-qian。只用卦名会撞（乾/谦都是 qian，渐/蹇都是 jian）。
 * - 按易学读音，不按常用音：屯 zhun、否 pi、贲 bi、解 xie、夬 guai、姤 gou、遁 dun、畜 xu、蛊 gu、噬嗑 shi-ke。
 * - ü 一律写 v（履 lv、旅 lv）；j/q/x/y 之后的 ü 按拼音照常写 u（需 xu、畜 xu）。
 */
export const GUA: readonly (readonly [name: string, slug: string])[] = [
	["乾为天", "qian-wei-tian"],
	["坤为地", "kun-wei-di"],
	["水雷屯", "shui-lei-zhun"],
	["山水蒙", "shan-shui-meng"],
	["水天需", "shui-tian-xu"],
	["天水讼", "tian-shui-song"],
	["地水师", "di-shui-shi"],
	["水地比", "shui-di-bi"],
	["风天小畜", "feng-tian-xiao-xu"],
	["天泽履", "tian-ze-lv"],
	["地天泰", "di-tian-tai"],
	["天地否", "tian-di-pi"],
	["天火同人", "tian-huo-tong-ren"],
	["火天大有", "huo-tian-da-you"],
	["地山谦", "di-shan-qian"],
	["雷地豫", "lei-di-yu"],
	["泽雷随", "ze-lei-sui"],
	["山风蛊", "shan-feng-gu"],
	["地泽临", "di-ze-lin"],
	["风地观", "feng-di-guan"],
	["火雷噬嗑", "huo-lei-shi-ke"],
	["山火贲", "shan-huo-bi"],
	["山地剥", "shan-di-bo"],
	["地雷复", "di-lei-fu"],
	["天雷无妄", "tian-lei-wu-wang"],
	["山天大畜", "shan-tian-da-xu"],
	["山雷颐", "shan-lei-yi"],
	["泽风大过", "ze-feng-da-guo"],
	["坎为水", "kan-wei-shui"],
	["离为火", "li-wei-huo"],
	["泽山咸", "ze-shan-xian"],
	["雷风恒", "lei-feng-heng"],
	["天山遁", "tian-shan-dun"],
	["雷天大壮", "lei-tian-da-zhuang"],
	["火地晋", "huo-di-jin"],
	["地火明夷", "di-huo-ming-yi"],
	["风火家人", "feng-huo-jia-ren"],
	["火泽睽", "huo-ze-kui"],
	["水山蹇", "shui-shan-jian"],
	["雷水解", "lei-shui-xie"],
	["山泽损", "shan-ze-sun"],
	["风雷益", "feng-lei-yi"],
	["泽天夬", "ze-tian-guai"],
	["天风姤", "tian-feng-gou"],
	["泽地萃", "ze-di-cui"],
	["地风升", "di-feng-sheng"],
	["泽水困", "ze-shui-kun"],
	["水风井", "shui-feng-jing"],
	["泽火革", "ze-huo-ge"],
	["火风鼎", "huo-feng-ding"],
	["震为雷", "zhen-wei-lei"],
	["艮为山", "gen-wei-shan"],
	["风山渐", "feng-shan-jian"],
	["雷泽归妹", "lei-ze-gui-mei"],
	["雷火丰", "lei-huo-feng"],
	["火山旅", "huo-shan-lv"],
	["巽为风", "xun-wei-feng"],
	["兑为泽", "dui-wei-ze"],
	["风水涣", "feng-shui-huan"],
	["水泽节", "shui-ze-jie"],
	["风泽中孚", "feng-ze-zhong-fu"],
	["雷山小过", "lei-shan-xiao-guo"],
	["水火既济", "shui-huo-ji-ji"],
	["火水未济", "huo-shui-wei-ji"],
];

/** 卦页网址，带尾斜杠（canonical、sitemap、站内链接都用这一种）：/gua/di-tian-tai/ */
export const guaPath = (name: string) => `/gua/${GUA.find(([n]) => n === name)?.[1]}/`;

/** 卦名简称：乾为天 → 乾，地天泰 → 泰，风天小畜 → 小畜。遁卦用「遁」，不用 guaci.json 首行的「遯」。 */
export const shortName = (name: string) => (name[1] === "为" ? name.slice(0, 1) : name.slice(2));

/**
 * 站酷小薇没有的字：卦名、卦辞、爻辞里出现的全部，由 tools/xiaowei-missing.py 算出
 * （换字体版本或改了 guaci.json 就重跑，把输出抄到这里）。
 */
const NO_XIAOWEI = /[㧑刲卼咥咷嗃夬姤寘愬柅洟牿甃畬禴稊窞繘繻纆胏脢臲茀菑蔀藟虩衎袽豮輹遯邅鞶頄颙餗鼫]/;

/**
 * 本该用站酷小薇的一段文字（一个卦名、一句卦辞、一条爻辞）实际用哪种字体：
 * 含小薇缺的字就整段改用宋体，不让浏览器逐字回退、一段里混着两种字体。
 * 返回 tokens.css 的变量名，页面写 `var(…)`，canvas 读它的值。
 */
export const fontOf = (text: string) => (NO_XIAOWEI.test(text) ? "--font-body" : "--font-display");

export interface YaoCi {
	/** 初九 … 上六，乾坤另有用九、用六 */
	title: string;
	/** 爻辞，不含爻题 */
	text: string;
	/** 小象：「象曰：…」 */
	xiang: string;
}

export interface GuaCi {
	/** 第十一卦 */
	no: string;
	/** 上卦、下卦：坤、乾 */
	upper: string;
	lower: string;
	/** 卦辞，整行（不一定以「泰：」开头，如「履虎尾…」） */
	ci: string;
	/** 「彖曰：…」 */
	tuan: string;
	/** 大象：「象曰：…」 */
	xiang: string;
	/** 初爻在前；乾、坤多一条用九、用六 */
	yao: YaoCi[];
}

/**
 * 拆开 guaci.json 的一卦。格式：首行「《易经》第十一卦 泰 地天泰 坤上乾下」，
 * 然后卦辞、彖、象各一行，一个空行，再是每爻一行爻辞、一行小象。
 */
export function parseGua(text: string): GuaCi {
	const [head = "", ci = "", tuan = "", xiang = "", , ...rest] = text.split("\n");
	const [no = "", , , trigrams = ""] = head.replace("《易经》", "").split(" ");
	const yao: YaoCi[] = [];
	for (let i = 0; i < rest.length; i += 2) {
		const line = rest[i] as string;
		yao.push({ title: line.slice(0, 2), text: line.slice(3), xiang: rest[i + 1] ?? "" });
	}
	return { no, upper: trigrams.slice(0, 1), lower: trigrams.slice(2, 3), ci, tuan, xiang, yao };
}
