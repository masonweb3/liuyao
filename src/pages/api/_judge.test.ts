// `_` prefix keeps Astro from routing this file.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK } from "../../lib/flow.js";

const env = vi.hoisted(
	() =>
		({}) as {
			TYPESAFE_API_KEY?: string;
			RATE_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> };
		},
);
vi.mock("cloudflare:workers", () => ({ env }));

const { POST, THRESHOLDS } = await import("./judge.js");

const call = (body: unknown) =>
	POST({
		request: new Request("http://x/api/judge", {
			method: "POST",
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	} as Parameters<typeof POST>[0]) as Promise<Response>;

function jev(topic: string, confidence: number, nouls: Partial<Record<string, number>> = {}) {
	const n = { self_harm: 0, emergency: 0, gambling: 0, sincere: 1, ...nouls };
	return Response.json({
		answers: {
			topic: { type: "choice", choice: topic, confidence },
			...Object.fromEntries(Object.entries(n).map(([k, v]) => [k, { type: "noul", noul: v }])),
		},
	});
}

beforeEach(() => {
	delete env.TYPESAFE_API_KEY;
	delete env.RATE_LIMITER;
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/judge", () => {
	it("没有 key 时直接回退，不调用 Jev", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		expect(await (await call({ question: "这次考试能过吗" })).json()).toEqual(FALLBACK);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("一次请求问五个问题，并按阈值给出判断", async () => {
		env.TYPESAFE_API_KEY = "k";
		const fetch = vi.fn(async () => jev("parents", 0.9, { self_harm: 0.4 }));
		vi.stubGlobal("fetch", fetch);
		const res = await call({ question: "  这次考试能过吗 " });
		expect(await res.json()).toEqual({
			topic: "父母",
			selfHarm: 0.4 >= THRESHOLDS.selfHarm,
			emergency: false,
			gambling: false,
			insincere: false,
		});
		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.typesafe.ai/v1/systemone");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer k");
		const body = JSON.parse(init.body as string);
		expect(body.model).toBe("jev-latest");
		expect(body.state).toBe("这次考试能过吗");
		expect(Object.keys(body.questions).sort()).toEqual(["emergency", "gambling", "self_harm", "sincere", "topic"]);
	});

	it.each([
		["置信度过低", async () => jev("parents", THRESHOLDS.topic - 0.01)],
		["无法判断", async () => jev("unclear", 0.95)],
		["Jev 出错", async () => new Response("", { status: 529 })],
		["超时或断网", async () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
	])("%s：让用户自己选类别", async (_, impl) => {
		env.TYPESAFE_API_KEY = "k";
		vi.stubGlobal("fetch", vi.fn(impl));
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await (await call({ question: "这次考试能过吗" })).json()).topic).toBeNull();
	});

	it.each([
		["不是 JSON", "not json"],
		["空白", { question: "   " }],
		["不是字符串", { question: 42 }],
		["超过 200 字", { question: "问".repeat(201) }],
	])("%s：400", async (_, body) => {
		expect((await call(body)).status).toBe(400);
	});

	it("200 字以内放行", async () => {
		expect((await call({ question: "问".repeat(200) })).status).toBe(200);
	});

	it("按 IP 限流；没有 binding 时放行", async () => {
		const limit = vi.fn(async () => ({ success: false }));
		env.RATE_LIMITER = { limit };
		const res = await POST({
			request: new Request("http://x/api/judge", {
				method: "POST",
				headers: { "cf-connecting-ip": "203.0.113.9" },
				body: JSON.stringify({ question: "这次考试能过吗" }),
			}),
		} as Parameters<typeof POST>[0]);
		expect((res as Response).status).toBe(429);
		expect(limit).toHaveBeenCalledWith({ key: "203.0.113.9" });
	});
});
