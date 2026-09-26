/**
 * 音效 —— 铜钱落盘与成卦磬声, synthesised with Web Audio: no files to ship
 * or license. Off by default; the choice is kept in this browser.
 */
const KEY = "liuyao:sound";

let on = (() => {
	try {
		return localStorage.getItem(KEY) === "on";
	} catch {
		return false;
	}
})();
let ac: AudioContext | undefined;

export const soundOn = () => on;

export function setSound(next: boolean) {
	on = next;
	try {
		if (on) localStorage.setItem(KEY, "on");
		else localStorage.removeItem(KEY);
	} catch {
		// Blocked storage: the choice lasts until the page closes.
	}
	unlock();
}

/** Browsers let audio start only inside a user gesture: call this from one. */
export function unlock() {
	if (!on) return;
	try {
		ac ??= new AudioContext();
		void ac.resume();
	} catch {
		// No Web Audio: stay silent.
	}
}

/** One decaying partial; bells and stones are sums of these. */
function partial(a: AudioContext, t: number, freq: number, gain: number, decay: number) {
	const o = a.createOscillator();
	const g = a.createGain();
	o.frequency.value = freq;
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain, t + 0.003);
	g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
	o.connect(g).connect(a.destination);
	o.start(t);
	o.stop(t + decay);
}

/** The tick of metal on wood that starts each clink. */
function tick(a: AudioContext, t: number) {
	const buf = a.createBuffer(1, Math.ceil(a.sampleRate * 0.02), a.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
	const n = a.createBufferSource();
	n.buffer = buf;
	const f = a.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = 3500;
	const g = a.createGain();
	g.gain.value = 0.12;
	n.connect(f).connect(g).connect(a.destination);
	n.start(t);
}

// Tuning: initial values, adjust by ear.
const CLINK = [
	[1, 0.07, 0.22],
	[1.52, 0.045, 0.16],
	[2.27, 0.03, 0.11],
	[3.11, 0.018, 0.07],
] as const;
const QING = [
	[1, 0.16, 4.5],
	[2.76, 0.07, 2.6],
	[5.4, 0.035, 1.4],
	[8.93, 0.015, 0.7],
] as const;

/** 铜钱落盘: three coins, a few tens of ms apart, each a short inharmonic clink. */
export function coinsSound() {
	const a = ac;
	if (!on || a?.state !== "running") return;
	for (let k = 0; k < 3; k++) {
		const t = a.currentTime + k * 0.07 + Math.random() * 0.03;
		const base = 2200 + Math.random() * 500;
		tick(a, t);
		for (const [ratio, gain, decay] of CLINK) partial(a, t, base * ratio, gain, decay);
	}
}

/** 成卦磬声: a stone chime's partials are not whole multiples; the low one rings longest. */
export function qingSound() {
	const a = ac;
	if (!on || a?.state !== "running") return;
	for (const [ratio, gain, decay] of QING) partial(a, a.currentTime, 392 * ratio, gain, decay);
}
