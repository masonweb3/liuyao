import { describe, expect, it } from "vitest";
import zi from "../data/quming-zi.json" with { type: "json" };
import { check, type Data, fold, lookup, measure, type Pick, type Result, table, wadeGiles, wuge, zhuyin } from "./quming";

const T = table(zi as unknown as Data);
const run = (sur: string, giv: string, picks: Record<number, Pick> = {}, hant = false) => {
	const r = measure(T, sur, giv, picks, hant);
	if ("missing" in r) throw new Error(`字表里没有 ${r.missing.ch}`);
	return r;
};
const five = (r: Result) => [r.wuge.tian, r.wuge.ren, r.wuge.di, r.wuge.wai, r.wuge.zong];
const kx = (ch: string) => lookup(T, ch)!.forms[0]!;

describe("康熙笔画", () => {
	// 调研 docs/review-m22/strokes-check.md §2a 的 120 字：输入 → 取用字形与最终取值（原书值，数字按数值，王 记 4）。
	// 取用字形也核对名字常用字形的默认（叶 → 葉、云 → 雲、钟 → 鍾、范 → 范、万 → 萬、丰 → 豐……）。
	const SAMPLE =
		"王王4 李李7 张張11 刘劉15 陈陳16 杨楊13 黄黃12 赵趙14 吴吳7 周周8 徐徐10 孙孫10 马馬10 朱朱6 胡胡11 郭郭15 何何7 林林8 " +
		"罗羅20 郑鄭19 梁梁11 谢謝17 宋宋7 唐唐10 许許11 韩韓17 冯馮12 邓鄧19 曹曹10 彭彭12 曾曾12 萧蕭18 田田5 董董15 潘潘16 " +
		"袁袁10 蔡蔡17 蒋蔣17 余余7 于于3 杜杜7 叶葉15 程程12 苏蘇22 魏魏18 吕呂7 丁丁2 沈沈8 钟鍾17 范范11 陆陸16 邱邱12 " +
		"邵邵12 郝郝14 阮阮12 陶陶16 江江7 汪汪8 欧歐15 阳陽17 诸諸16 葛葛15 一一1 二二2 三三3 四四4 五五5 六六6 七七7 八八8 " +
		"九九9 十十10 百百6 千千3 万萬15 浩浩11 涵涵12 泽澤17 清清12 海海11 泰泰9 振振11 扬揚13 怡怡9 恒恆10 献獻20 祥祥11 " +
		"福福14 裕裕13 初初7 琳琳13 琪琪13 瑶瑤15 玲玲10 玉玉5 英英11 芳芳10 萍萍14 华華14 隆隆17 都都16 朋朋8 朗朗11 期期12 " +
		"育育10 能能12 胜勝12 进進15 达達16 远遠17 逸逸15 发發12 后后6 云雲12 志志7 丰豐18 松松8 郁郁13 伟偉11 婷婷12";

	it("调研的 120 字：字形与笔画全对", () => {
		const rows = SAMPLE.split(" ");
		expect(rows).toHaveLength(120);
		for (const row of rows) {
			const [ch, form, n] = [row[0]!, row[1]!, Number(row.slice(2))];
			const f = kx(ch);
			expect(f.form, ch).toBe(form);
			expect(f.kx, ch).toBe(n);
		}
	});

	it("看过影印本的例外：曹 10、成 7、城 10、節 15、既 11，写明页码", () => {
		for (const [ch, n, page] of [["曹", 10, 502], ["成", 7, 411], ["城", 10, 229], ["节", 15, 891], ["既", 11, 485]] as const) {
			const f = kx(ch);
			expect([f.kx, f.page], ch).toEqual([n, page]);
			expect(f.unchecked, ch).toBe(false);
		}
		// 曹：原书曰部 6 画，今写 11 画
		expect([kx("曹").rad, kx("曹").res, kx("曹").today]).toEqual([73, 6, 11]);
	});

	it("只对过网站转录、没看影印本的（盛 誠 著 署 戴 翼 卿 鷹）照算法值，标「未逐字核对原书」", () => {
		for (const [ch, n] of [["盛", 11], ["诚", 13], ["著", 14], ["署", 14], ["戴", 17], ["翼", 17], ["卿", 10], ["鹰", 24]] as const) {
			const f = kx(ch);
			expect(f.kx, ch).toBe(n);
			expect(f.page, ch).toBeUndefined();
			expect(f.unchecked, ch).toBe(true);
		}
	});

	it("两条约定：数字按数值，王 记 4（原书玉部零画）；书序里不起疑的字不标", () => {
		expect(kx("四")).toMatchObject({ kx: 4, conv: "num", rad: 31, res: 2, unchecked: false });
		expect(kx("王")).toMatchObject({ kx: 4, conv: "wang", rad: 96, res: 0, unchecked: false });
		expect(kx("林").unchecked).toBe(false);
		// 偏旁按部首本字：涵 水部 8 画（今写 11），陽 阜部 9 画（今写 12）
		expect([kx("涵").rad, kx("涵").res, kx("涵").today, kx("涵").kx]).toEqual([85, 8, 11, 12]);
		expect([kx("阳").rad, kx("阳").res, kx("阳").today, kx("阳").kx]).toEqual([170, 9, 12, 17]);
	});

	it("一简多繁：云 可选 雲 12、云 4（雲在前）；繁体页写的字本身是一个字形时照写的算", () => {
		expect(lookup(T, "云")!.forms.map((f) => [f.form, f.kx])).toEqual([["雲", 12], ["云", 4]]);
		expect(lookup(T, "云", true)!.forms.map((f) => f.form)).toEqual(["云"]);
		expect(lookup(T, "发", true)!.forms.map((f) => f.form)).toEqual(["發", "髮"]);
		// 繁体输入：照写的字形，读音取规范字的
		expect(lookup(T, "陳")).toMatchObject({ simp: "陈", readings: ["chén"], inTgh: true });
		expect(lookup(T, "陳")!.forms.map((f) => f.form)).toEqual(["陳"]);
		// 鍾 反查规范字：钟 在规范字表里排在 锺 前
		expect(lookup(T, "鍾")!.simp).toBe("钟");
	});

	it("规范字表外、Big5 里有的字照算：珮 玉部 6 画 11", () => {
		expect(lookup(T, "珮")).toMatchObject({ simp: "珮", inTgh: false, readings: ["pèi"], jyut: "pui3" });
		expect(kx("珮").kx).toBe(11);
	});

	it("字表外的字：峯 不在 8105、不在 Big5，Unihan 记它是 峰 的异体；瀞 没有异体可按", () => {
		expect(lookup(T, "峯")).toBeNull();
		expect(measure(T, "李", "峯")).toEqual({ missing: { index: 1, ch: "峯", variant: "峰" } });
		expect(measure(T, "王", "瀞")).toEqual({ missing: { index: 1, ch: "瀞", variant: null } });
		expect(five(run("李", "峯", { 1: { sub: "峰" } }))).toEqual([8, 17, 11, 2, 17]);
	});
});

describe("五格与三才", () => {
	it("设计稿的例子逐项对上", () => {
		expect(five(run("林", "雨涵"))).toEqual([9, 16, 20, 13, 28]);
		expect(run("林", "雨涵").sancai).toBe("水土水");
		expect(five(run("施", "涛"))).toEqual([10, 27, 19, 2, 27]);
		expect(five(run("欧阳", "静"))).toEqual([32, 33, 17, 16, 48]);
		expect(run("欧阳", "静").sancai).toBe("木火金");
		expect(five(run("王", "琳"))).toEqual([5, 17, 14, 2, 17]);
		expect(five(run("单", "乐"))).toEqual([13, 27, 16, 2, 27]);
		expect(five(run("叶", "云"))).toEqual([16, 27, 13, 2, 27]);
		expect(five(run("叶", "云", { 1: { form: "云" } }))).toEqual([16, 19, 5, 2, 19]);
		expect(five(run("陳", "怡珮", {}, true))).toEqual([17, 25, 20, 12, 36]);
		expect(run("陳", "怡珮", {}, true).sancai).toBe("金土水");
	});

	it("外格：单姓单名固定 2；复姓双名 = 姓首 + 名末；三字名地格三字相加、外格 = 1 + 名的后两字", () => {
		expect(wuge([4], [13]).wai).toBe(2);
		expect(wuge([15, 17], [16, 8])).toEqual({ tian: 32, ren: 33, di: 24, wai: 23, zong: 56 });
		expect(wuge([8], [8, 12, 9])).toMatchObject({ di: 29, wai: 22, zong: 37 });
	});

	it("超过 81 减 80，81 自成一条", () => {
		expect([fold(81), fold(82), fold(100), fold(161), fold(162)]).toEqual([81, 2, 20, 81, 2]);
	});
});

describe("读音与写法", () => {
	it("姓查姓氏表，不让选：单 shàn、粤 sin6；表里没有的取默认读音（叶 yè）", () => {
		const r = run("单", "乐");
		expect(r.chars[0]).toMatchObject({ read: "shàn", jyut: "sin6", fixed: true });
		expect(r.chars[1]).toMatchObject({ read: "lè", jyut: "lok6", fixed: false });
		expect(r.chars[1]!.zi.readings).toEqual(["lè", "yuè"]);
		expect(run("单", "乐", { 1: { read: "yuè" } }).roman.py).toBe("Shan Yue");
		expect(run("叶", "云").chars[0]).toMatchObject({ read: "yè", fixed: false });
		// 点选不在读音表里的读音不算
		expect(run("单", "乐", { 1: { read: "xx" } }).chars[1]!.read).toBe("lè");
	});

	it("姓氏表里每个读音都在该字的读音里", () => {
		for (const [s, rows] of Object.entries((zi as unknown as Data).sur))
			[...s].forEach((ch, i) => expect(lookup(T, ch)!.readings, s).toContain(rows[i]![0]));
	});

	it("拼音、威妥玛、粤拼、港式（只有姓）", () => {
		expect(run("林", "雨涵").roman).toEqual({ py: "Lin Yuhan", wg: "Lin Yü-han", jp: "lam4 jyu5 haam4", hk: "Lam" });
		expect(run("欧阳", "静").roman).toEqual({ py: "Ouyang Jing", wg: "Ou-yang Ching", jp: "au1 joeng4 zing6", hk: "Au Yeung" });
		expect(run("陳", "怡珮", {}, true).roman).toMatchObject({ py: "Chen Yipei", wg: "Ch'en I-p'ei", hk: "Chan" });
		expect(run("吕", "安").roman.py).toBe("Lü An");
		expect(run("王", "欣安").roman.py).toBe("Wang Xin'an");
	});

	it("威妥玛的拼法", () => {
		const cases =
			"lin:lin yǔ:yü hán:han shī:shih tāo:t'ao ōu:ou yáng:yang jìng:ching chén:ch'en yí:i pèi:p'ei wáng:wang lè:le yuè:yüeh yè:yeh " +
			"yún:yün lǐ:li fēng:feng cáo:ts'ao zhāng:chang xiǎo:hsiao qiáng:ch'iang zhōu:chou guó:kuo guì:kuei xué:hsüeh lǚ:lü nüè:nüeh " +
			"rì:jih zǐ:tzu sì:ssu cí:tz'u gē:ko kè:k'o hé:ho dé:te duō:to shuō:shuo kǒng:k'ung xióng:hsiung ér:erh juān:chüan qù:ch'ü " +
			"huí:hui duì:tui biān:pien jiě:chieh rén:jen zēng:tseng cōng:ts'ung sūn:sun lún:lun zhuō:cho";
		for (const c of cases.split(" ")) {
			const [py, wg] = c.split(":") as [string, string];
			expect(wadeGiles(py), py).toBe(wg);
		}
	});

	it("注音由台湾读音机械换算", () => {
		const cases = "chén:ㄔㄣˊ yí:ㄧˊ pèi:ㄆㄟˋ lín:ㄌㄧㄣˊ lè:ㄌㄜˋ yuè:ㄩㄝˋ shī:ㄕ zhī:ㄓ jūn:ㄐㄩㄣ xué:ㄒㄩㄝˊ lǚ:ㄌㄩˇ de:˙ㄉㄜ ér:ㄦˊ wēng:ㄨㄥ";
		for (const c of cases.split(" ")) {
			const [py, zy] = c.split(":") as [string, string];
			expect(zhuyin(py), py).toBe(zy);
		}
	});
});

describe("英文谐音（M22-13、M22-30）", () => {
	it("施涛：拼音连写 Shitao 跨字命中；分开写与威妥玛都避开", () => {
		const r = run("施", "涛");
		expect(r.hits).toEqual([{ sys: "py", word: "shit", joined: "Shitao", cross: true, sep: "Shi Tao" }]);
		expect(r.roman.wg).toBe("Shih T'ao");
	});

	it("林雨涵、欧阳静、王琳都没有命中；粤拼正好是一个音节的 tit、mong 放行", () => {
		for (const [s, g] of [["林", "雨涵"], ["欧阳", "静"], ["王", "琳"]]) expect(run(s!, g!).hits, s! + g!).toEqual([]);
		expect(run("铁", "望").hits).toEqual([]);
	});

	it("粤拼单字正好是自建表里的词也提示（福 fuk1）", () => {
		expect(run("黄", "福").hits).toContainEqual({ sys: "jp", word: "fuk", joined: "Wongfuk", cross: false, sep: "Wong Fuk" });
	});
});

describe("复姓与校验", () => {
	it("姓欧、名阳静：照写的算，提示欧阳是复姓（M22-25）；本来就是复姓或单名时不提示", () => {
		const r = run("欧", "阳静");
		expect(r.fu).toBe("欧阳");
		expect(five(r)).toEqual([16, 32, 33, 17, 48]);
		expect(run("歐", "陽靜", {}, true).fu).toBe("歐陽");
		expect(run("欧阳", "静").fu).toBeNull();
		expect(run("欧", "阳").fu).toBeNull();
	});

	it("输入校验：姓 1–2 个汉字、名 1–3 个汉字，按字数算（补充平面的字也是一个字）", () => {
		expect(check("林", "雨涵")).toBeNull();
		expect(check("", "")).toBe("empty");
		expect(check("", "林雨涵")).toBe("split");
		expect(check("", "涵")).toBe("surEmpty");
		expect(check("Lin", "雨涵")).toBe("surBad");
		expect(check("欧阳林", "涵")).toBe("surBad");
		expect(check("林", "")).toBe("givEmpty");
		expect(check("林", "Yuhan")).toBe("givBad");
		expect(check("林", "雨涵涵涵")).toBe("givBad");
		expect(check("林", "𬌗𬌗𬌗")).toBeNull();
	});
});
