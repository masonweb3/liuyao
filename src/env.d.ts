// The two things judge.ts reads from the Worker environment. Declared by hand
// rather than generating the full runtime types with `wrangler types`.
declare module "cloudflare:workers" {
	export const env: {
		TYPESAFE_API_KEY?: string;
		/** Cloudflare ratelimit binding (wrangler.jsonc); absent means no limit. */
		RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
	};
}
