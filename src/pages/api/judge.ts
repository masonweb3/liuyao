/**
 * 所问的语义判断 —— one Jev request, five questions over the question text:
 * which 用神 category it belongs to, and four safety checks.
 *
 * Every failure path (no key, timeout, error, low confidence) returns
 * {@link FALLBACK}: the page then asks the user to pick the category, so the
 * whole flow works without Jev. The question text is never logged.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { Topic } from "../../lib/liuyao/duan.js";

export const prerender = false;

// 初始值：按 eval/questions.json（45 条，2026-09-26）定，待用真实问题集复核。
export const THRESHOLDS = {
	/** topic 置信度低于此值，让用户自己选类别。 */
	topic: 0.6,
	/** 宁可误拦，不可漏拦。评测中自伤样本最低 0.72，其余最高 0.29。 */
	selfHarm: 0.3,
	emergency: 0.7,
	gambling: 0.7,
	/** sincere 低于此值，请用户换个说法。 */
	sincere: 0.3,
};
const MAX_LENGTH = 200;
const TIMEOUT_MS = 3000;

/**
 * Flags are independent — a 跳楼 question is both selfHarm and emergency, a
 * lottery question also gets topic 财. The page applies them in this order:
 * selfHarm（阻断，显示求助资源）→ gambling（婉拒）→ emergency（提示，确认后可继续）
 * → insincere（请用户重写）→ topic（null 时让用户自己选）.
 */
export interface Judgement {
	/** `null`: no confident category; the page asks the user to pick one. */
	topic: Topic | null;
	selfHarm: boolean;
	emergency: boolean;
	gambling: boolean;
	insincere: boolean;
}

/** Jev's raw answers, before thresholds. */
export interface Raw {
	topic: string;
	confidence: number;
	selfHarm: number;
	emergency: number;
	gambling: number;
	sincere: number;
}

export const FALLBACK: Judgement = {
	topic: null,
	selfHarm: false,
	emergency: false,
	gambling: false,
	insincere: false,
};

const TOPICS: Record<string, Topic> = {
	wealth: "财",
	career: "事业",
	parents: "父母",
	children: "子孙",
	siblings: "兄弟",
	romance: "婚恋",
	self: "自身",
};

const noul = (instructions: string, yes: string, no: string) => ({
	type: "noul",
	instructions,
	criteria: { true: yes, false: no },
});

// English instructions: Jev's primary training language. The state is the
// user's question as typed, usually Chinese.
const QUESTIONS = {
	topic: {
		type: "choice",
		instructions:
			"This is a question someone wants answered by I Ching (六爻) divination. Which area of the asker's life is it about?",
		criteria: {
			wealth: {
				what: "Money: income, bonuses, business profit, deals, buying and selling, investments, money lent out or lost.",
				examples: ["这笔生意值得做吗", "借出去的钱能要回来吗"],
			},
			career: {
				what: "Work and official matters: job offers, interviews, promotion, the asker's company or post, lawsuits and disputes with employers or authorities.",
				examples: ["下个月跳槽能成吗", "这场官司能赢吗"],
			},
			parents: {
				what: "Parents, elders and teachers; houses, land and vehicles; documents, contracts, visas and certificates; exams and study results.",
				examples: ["这次考试能过吗", "签证能批下来吗", "妈妈的手术顺利吗"],
			},
			children: {
				what: "Children, pregnancy, grandchildren, pets and juniors; medical treatment and medicine.",
				examples: ["今年能怀上孩子吗", "孩子最近叛逆，能好转吗", "这个治疗有效吗"],
			},
			siblings: {
				what: "Siblings, friends and peers; business partners; competitors and rivals.",
				examples: ["和朋友合伙开店合适吗", "这次竞标能赢过对手吗"],
			},
			romance: {
				what: "Romance and marriage: a crush, a partner, getting back together, marriage prospects.",
				examples: ["他还喜欢我吗", "和前任还有可能复合吗"],
			},
			self: {
				what: "The asker's own overall fortune, health or safety, when no other area is the focus.",
				examples: ["我今年运势如何", "这次出远门平安吗"],
			},
			unclear: "Not a real question, or none of the areas above fits.",
		},
	},
	self_harm: noul(
		"Does the asker suggest they may be thinking about suicide or harming themselves?",
		"Hints at suicidal thoughts, self-harm, or not wanting to live.",
		"Shows no sign the asker wants to hurt themselves.",
	),
	emergency: noul(
		"Does the message describe an emergency happening now that needs a doctor, the police or a lawyer right away?",
		"An ongoing emergency: acute illness or injury, violence or threats, a crime in progress, urgent legal danger.",
		"An ordinary question about how something will turn out, even if it involves health or law.",
	),
	gambling: noul(
		"Is the asker seeking lottery numbers or the outcome of a gamble or bet?",
		"Lottery numbers, casino games, sports betting or any wager.",
		"Anything else, including ordinary business or investment questions.",
	),
	sincere: noul(
		"Is this a genuine question about the asker's life that they want answered?",
		"A real concern, stated clearly enough to know what is being asked.",
		"Gibberish, a greeting, a test message, a joke, or too vague to tell what is asked.",
	),
};

export async function askJev(question: string, key: string, signal?: AbortSignal): Promise<Raw> {
	const res = await fetch("https://api.typesafe.ai/v1/systemone", {
		method: "POST",
		headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
		body: JSON.stringify({ model: "jev-latest", state: question, questions: QUESTIONS }),
		signal,
	});
	if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
	const { answers: a } = (await res.json()) as {
		answers: {
			topic: { choice: string; confidence: number };
			self_harm: { noul: number };
			emergency: { noul: number };
			gambling: { noul: number };
			sincere: { noul: number };
		};
	};
	return {
		topic: a.topic.choice,
		confidence: a.topic.confidence,
		selfHarm: a.self_harm.noul,
		emergency: a.emergency.noul,
		gambling: a.gambling.noul,
		sincere: a.sincere.noul,
	};
}

export function decide(raw: Raw): Judgement {
	return {
		topic: raw.confidence >= THRESHOLDS.topic ? (TOPICS[raw.topic] ?? null) : null,
		selfHarm: raw.selfHarm >= THRESHOLDS.selfHarm,
		emergency: raw.emergency >= THRESHOLDS.emergency,
		gambling: raw.gambling >= THRESHOLDS.gambling,
		insincere: raw.sincere < THRESHOLDS.sincere,
	};
}

export const POST: APIRoute = async ({ request }) => {
	let question: unknown;
	try {
		({ question } = (await request.json()) as { question?: unknown });
	} catch {
		return Response.json({ error: "bad-request" }, { status: 400 });
	}
	question = typeof question === "string" ? question.trim() : question;
	if (typeof question !== "string" || question === "" || [...question].length > MAX_LENGTH)
		return Response.json({ error: "bad-request" }, { status: 400 });

	const ip = request.headers.get("cf-connecting-ip") ?? "local";
	const limit = await env.RATE_LIMITER?.limit({ key: ip });
	if (limit && !limit.success) return Response.json({ error: "rate-limited" }, { status: 429 });

	if (!env.TYPESAFE_API_KEY) return Response.json(FALLBACK);
	try {
		const raw = await askJev(question, env.TYPESAFE_API_KEY, AbortSignal.timeout(TIMEOUT_MS));
		return Response.json(decide(raw));
	} catch (err) {
		console.error("judge fallback:", err instanceof Error ? `${err.name} ${err.message}` : "unknown");
		return Response.json(FALLBACK);
	}
};
