/**
 * 界面文案 the design artboards do not already carry. Pages that do have an
 * artboard (首屏、写下所问、择类、自伤拦截、彩票赌博、往卦、解读页) take their copy
 * verbatim from the design. Original copy, CC BY-NC-SA 4.0 (see NOTICE).
 */

/** 结果页与分享卡常驻 (AGENTS.md §1.5). */
export const DISCLAIMER = ["AI 辅助判断 · 仅供传统文化参考与娱乐", "不构成医疗、法律或投资建议"] as const;

/** Jev `emergency`: shown first; the user may continue after confirming. */
export const EMERGENCY = {
	title: "先顾眼前",
	body: [
		"你写下的事，听起来需要尽快得到现实中的帮助。",
		"涉及身体，请先就医；涉及人身安全，请先报警；涉及纠纷，请先咨询律师。",
	],
	back: "我先去处理",
	proceed: "已经妥当，继续起卦",
	note: "如果你正身处危险之中，请立即拨打当地紧急电话。",
} as const;

/** Jev `sincere` too low: ask for a rewrite. */
export const INSINCERE = {
	title: "再说具体些",
	body: "这句话，卦象不好回答。试着写下一件具体的事：关于什么，想知道什么。",
	action: "重新写",
} as const;

/** 往卦 with no records. */
export const HISTORY_EMPTY = {
	title: "还没有往卦",
	body: "起过的卦会记在这里，只保存在这台设备的浏览器里。",
	action: "起一卦",
} as const;

export const ERRORS = {
	empty: "先写下想问的事。",
	tooLong: "所问请在 200 字以内。",
	/** 一事一占: the same question has been cast before. */
	asked: "这件事已经起过卦。同一件事，一卦为定，可在往卦中回看。",
	/** Jev timed out, failed or was unsure: fall back to 择类. */
	topicFallback: "这一次未能自动归类，请为所问择一类。",
	rateLimited: "问得有些频繁，稍歇一会儿再来。",
	network: "网络似乎不太顺畅，请稍后再试。",
	/** 手动排盘 */
	yao: "请填六个数字，由初爻到上爻，每个是 6、7、8 或 9。",
	when: "请填 1900 至 2100 年之间的起卦时间。",
	storage: "这台设备暂时无法保存往卦，本次结果不会留下记录。",
	share: "分享卡没能生成，请稍后再试。",
} as const;
