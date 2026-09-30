/**
 * 界面文案 the design artboards do not already carry. Pages that do have an
 * artboard (首屏、写下所问、择类、自伤拦截、彩票赌博、往卦、解读页) take their copy
 * verbatim from the design; 往卦复盘 (M14) is kept here too, so 繁体 (M12b) finds it in
 * one place. Original copy, CC BY-NC-SA 4.0 (see NOTICE).
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

/**
 * 往卦列表的按需包没载入。浏览器记住了失败，页内重试不会再发请求，所以请人重新打开。
 * History.astro 写进页面；不放进 ERRORS：ERRORS 整个在首屏包里。
 */
export const HISTORY_FAIL = "往卦没能打开，网络似乎不太顺畅。请稍后重新打开本页。";

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

// 往卦复盘（M14，设计稿 16–18、D13–D15）。{name} 是留给 view.ts 填的空：Reading.astro、History.astro
// 在构建时把这些字写进页面，按需加载的 view.ts 只填数字、日期、所问和附言，首屏脚本里没有这些字。

/** 解读页「到时提醒我」和它生成的 .ics。 */
export const REMIND = {
	label: "到时提醒",
	title: "到时提醒我",
	lede: "过些日子回来，记下后来怎样。",
	legend: "几天后提醒",
	/** 天数片，{n} 为 3、7、30；片的第二行是到期日。 */
	day: "{n} 天后",
	/** 两个按钮的组名；按平台排序，主选项在前。 */
	add: "加入日历",
	apple: "Apple 日历",
	google: "Google 日历",
	fine: "不收邮箱，不推送。日历里不写你问的事。",
	/** 点了之后的提示，按所点的日历分两种。Google 从链接建的日程定不了提醒时刻，用日历自己的默认通知。 */
	done: {
		apple: "已生成 {due}的日历提醒。按系统提示，或打开下载的文件，加进日历即可；到那天，在往卦里点开这一卦。",
		google: "已在 Google 日历里填好 {due}的提醒，点「保存」即可；提醒时刻按你日历的默认通知。到那天，在往卦里点开这一卦。",
	},
	/**
	 * 接在完成提示后面：提醒没写进往卦（存储被禁用、写满，或找不到这一卦）。旧卦本来就在往卦里，
	 * 不能说「本次结果不会留下记录」；新卦整卦没存上时，页底另有 ERRORS.storage。
	 */
	unsaved: "日历里的提醒照常，只是没能记进这台设备的往卦。",
	/**
	 * 日历同步到云端、共享给别人：只写起卦日期和卦名，不写所问、吉凶、附言。
	 * 「同一台设备」那句：日历同步到别的设备后点链接，看到的往卦是空的。
	 */
	ics: {
		summary: "六爻 · 回看一卦",
		body: "{date}起的一卦：{gua}。过些日子了，回来看看后来怎样。往卦只保存在起卦那台设备的浏览器里，请用同一台设备打开。",
	},
} as const;

/** 回访卡。选项的键存进往卦（src/lib/revisit.ts 的 OUTCOMES），显示用这里的字。 */
export const REVIEW = {
	kicker: "回访",
	ask: "{ago}你问「{q}」，后来怎样了？",
	outcomes: { yes: "应了", half: "一半", no: "没应", pending: "还没结果", skip: "不想记" },
	note: "附一句（可不写）",
	local: "只存在这台设备的浏览器里",
	save: "记下",
	pick: "先选一项",
	saved: "已记下",
	doneKicker: "回访 · {at}记下",
	doneAsk: "{ago}你问「{q}」",
	told: "你记下：{outcome}",
	skipped: "这一卦不记",
	edit: "修改",
	editLabel: "修改回访",
	/** 凶卦的回访卡以这句收尾，不加别的话。 */
	bless: "不论结果如何，愿你安好。",
} as const;

/** 往卦列表：个人复盘一行与「自记」列。N 为 0 时整行不出现。 */
export const TALLY = {
	line: "你记下的 {n} 卦里，自认应验 {x} 卦",
	mine: "自记",
} as const;
