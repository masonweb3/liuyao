/**
 * 六十四卦的网址。零 DOM、零依赖：sitemap、卦页的 getStaticPaths、解读页的卦名链接都从这里取。
 * 单独成一个模块，是为了让它只进解读的按需加载包，不进首屏的起卦脚本。
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
export function guaPath(name: string): string {
	const slug = GUA.find(([n]) => n === name)?.[1];
	if (!slug) throw new Error(`不认识的卦名：${name}`);
	return `/gua/${slug}/`;
}
