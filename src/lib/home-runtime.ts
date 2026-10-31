import type { ERRORS } from '../data/copy';
import type words from '../data/home-runtime.json';
export type HomeRuntime = typeof words & {
	errors: {[K in keyof typeof ERRORS]: string};
	disclaimer: readonly string[];
	names: Record<string,string>;
};
