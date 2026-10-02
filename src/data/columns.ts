// 栏目导航的栏目表（M16）：首页首屏和纸面页头共用（src/components/Columns.astro）。
// 按上线先后加在末尾，已有的位置不动；还没上线的栏目不写，不做「即将上线」。
// 加一栏：加一行，再重跑 tools/subset-fonts.py（首页导航的字要进首屏字形子集，它从这里读简体栏目名；
// glyphs.test.ts 会核对）。
export interface Column {
	/** 这一栏的首页，带尾斜杠 */
	path: string;
	hans: string;
	/** 繁体页上的栏目名（台湾用语，逐条校对） */
	hant: string;
	/** 这一栏的繁体首页；没有就链简体页（首页的繁体是 M12b） */
	hantPath?: string;
}

export const COLUMNS: Column[] = [
	{ path: "/", hans: "起卦", hant: "起卦" },
	{ path: "/gua/", hans: "六十四卦", hant: "六十四卦", hantPath: "/zh-hant/gua/" },
	// 繁体用台湾日常的叫法「農民曆」（M16-6）；网址仍是 huangli
	{ path: "/huangli/", hans: "黄历", hant: "農民曆", hantPath: "/zh-hant/huangli/" },
	{ path: "/bazi/", hans: "八字", hant: "八字", hantPath: "/zh-hant/bazi/" },
	// 梅花易数（M21）：先只有简体（M21-20），繁体页上也链简体页
	{ path: "/meihua/", hans: "梅花", hant: "梅花" },
	// 取名（M22a）：栏目首页先放测名，八十一数页也算这一栏；M23 的起名进同一栏（M22-7）
	{ path: "/quming/", hans: "取名", hant: "取名", hantPath: "/zh-hant/quming/" },
];
