// 测名的隐私检查（M22-5、M22-17、M22-20、M22-29）：不在 CI 里跑（CI 没有浏览器），在测试服务器上对着预览站跑。
// 文件名不带 .test，免得 vitest 收进去。用法（playwright 1.63 的镜像，--network host）：
//   docker run --rm --network host -v ~/liuyao/tools:/w -w /w mcr.microsoft.com/playwright:v1.63.0-noble \
//     sh -c "npm init -y >/dev/null && npm i -s playwright@1.63.0 >/dev/null 2>&1 && BASE=http://localhost:4321 node quming-privacy.mjs"
// 检查：
// 1. 打开页面、点进输入框、字表下载完以后，写名字、点测名、点选字形与读音、按异体算、改成复姓，全程没有任何网络请求（含字体、预取）；
// 2. 输入框、提示与整块结果里每个元素（含 ::before、::after）的 computed font-family 里没有本页 @font-face 声明过的字体名；
// 3. 名字不进网址、不进 localStorage / sessionStorage；pagehide 以后输入框与结果都清空。
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4321";
const CASES = [
	{ path: "/quming/", steps: [["林", "雨涵"], ["施", "涛"], ["叶", "云", 'button[data-act=form][data-v="云"]'], ["单", "乐", 'button[data-act=read][data-v="yuè"]'], ["李", "峯", "button[data-act=sub]"], ["欧", "阳静", "button[data-act=fu]"], ["王", "琳"], ["陳", "怡珮"]] },
	{ path: "/zh-hant/quming/", steps: [["陳", "怡珮"], ["葉", "雲"], ["单", "乐", 'button[data-act=read][data-v="yuè"]'], ["歐", "陽靜", "button[data-act=fu]"]] },
];

const browser = await chromium.launch();
let failed = false;
const fail = (...m) => {
	failed = true;
	console.log("FAIL", ...m);
};
for (const c of CASES) {
	const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
	const page = await ctx.newPage();
	await page.goto(BASE + c.path, { waitUntil: "networkidle" });
	// 异步字体表（media=print onload）换上、首屏字体都下完，再点进输入框取字表
	await page.waitForFunction(() => [...document.querySelectorAll('link[rel=stylesheet][media]')].every((l) => l.media === "all"));
	await page.evaluate(() => document.fonts.ready);
	const zi = page.waitForResponse((r) => /quming-zi\..*\.json$/.test(r.url()));
	await page.focus("#qm-sur");
	const res = await zi;
	const body = await res.body();
	console.log(c.path, "字表", res.status(), body.length, "B", res.headers()["content-encoding"] ?? "(未压缩)");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(800);
	const url0 = page.url();

	const seen = [];
	page.on("request", (r) => seen.push(r.url()));
	for (const [s, g, click] of c.steps) {
		await page.fill("#qm-sur", "");
		await page.fill("#qm-giv", "");
		await page.type("#qm-sur", s);
		await page.type("#qm-giv", g);
		await page.click("[data-f=submit]");
		await page.waitForSelector("[data-f=result]:not([hidden])");
		if (click) {
			await page.click(click);
			await page.waitForTimeout(100);
		}
		// 按回车再测一次（回车由脚本接）
		await page.press("#qm-giv", "Enter");
		await page.waitForTimeout(600);
		const bad = await page.evaluate(() => {
			const faces = new Set([...document.fonts].map((f) => f.family.replace(/^['"]|['"]$/g, "").toLowerCase()));
			const els = [document.getElementById("qm-sur"), document.getElementById("qm-giv"), ...document.querySelectorAll("[data-f=result], [data-f=result] *, [data-f=err], [data-f=status], [data-f=status] *, [data-f=fail], [data-f=fail] *")];
			const out = [];
			for (const el of els)
				for (const pseudo of [null, "::before", "::after"]) {
					const fam = getComputedStyle(el, pseudo).fontFamily.split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "").toLowerCase());
					const hit = fam.filter((x) => faces.has(x));
					if (hit.length) out.push(`${el.tagName}.${el.className}${pseudo ?? ""}: ${hit.join(",")}`);
				}
			return { out: [...new Set(out)], faces: [...faces], n: els.length };
		});
		if (bad.out.length) fail(c.path, s + g, "用了网页字体", bad.out.slice(0, 5));
		else console.log(c.path, s + g, `${bad.n} 个元素的字体都不是 @font-face（本页声明的：${bad.faces.join("、")}）`);
	}
	if (seen.length) fail(c.path, "测名期间有请求", seen);
	else console.log(c.path, "测名期间请求数 0");
	if (page.url() !== url0) fail(c.path, "网址变了", page.url());
	const store = await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]);
	if (store.flat().length) fail(c.path, "存了东西", store);
	await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
	const left = await page.evaluate(() => [document.getElementById("qm-sur").value, document.getElementById("qm-giv").value, document.querySelector("[data-f=result]").innerHTML]);
	if (left.join("")) fail(c.path, "pagehide 以后没清空", left);
	else console.log(c.path, "pagehide 以后输入框与结果都清空");
	await ctx.close();
}
await browser.close();
console.log(failed ? "有问题" : "全部通过");
process.exit(failed ? 1 : 0);
