/**
 * 卦页用的小工具：卦名简称、卦名字体、卦爻辞拆分。零 DOM，也不引数据文件。
 * 卦页网址在 src/data/gua-slugs.ts。
 */

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
