# Liuyao · 六爻

**[sixyao.app](https://sixyao.app)** · [中文](README.zh-CN.md)

A six-line (六爻, *liùyáo*) I Ching divination site in a quiet Chinese style. Write down your question, settle your mind, toss three coins six times, and read the hexagram. The interface is in Simplified Chinese; the 64 hexagram pages also come in Traditional Chinese (Taiwan usage) under `/zh-hant/gua/`.

- **The chart is computed, not generated.** Najia (纳甲), the six relations, world and response lines, six spirits, void branches, hidden spirits and strength are all worked out by deterministic code. The same cast always gives the same chart. Tests cover the worked examples from *Zengshan Buyi* (增删卜易) and 4,096 parity fixtures.
- **Good or bad is decided by rules**, with the reasons shown, never by a language model.
- **[TypeSafe Jev](https://docs.typesafe.ai) only reads the question**: it sorts it into a topic, which picks the use god (用神), and screens out self-harm, emergencies and gambling. If Jev is unavailable, you pick the topic yourself and everything still works.
- **Readings** pair the original judgments and line texts (public domain) with plain-language commentary written for this project.
- **On a phone** you can hold the 摇 button, or turn on shake mode and shake the phone itself.
- **Free, no ads, no sign-in.** Visits are counted with Cloudflare Web Analytics, which sets no cookies and does not track individuals; there are no other trackers. Past casts stay in your browser. The question is sent once to Jev for classification and is not logged.

## Stack

Astro 7 on Cloudflare Workers, TypeScript, [tyme4ts](https://github.com/6tail/tyme4ts) for the calendar, Vitest. Every page is prerendered; the only server route is `/api/judge`, which calls Jev.

## Development

- [AGENTS.md](AGENTS.md): conventions for people and coding agents (in Chinese).
- [CHANGELOG.md](CHANGELOG.md): what changed in each release. Versions are release dates.

## License

Source-available, **not open source**: commercial use is not allowed.

- Code: [PolyForm Noncommercial License 1.0.0](LICENSE.md). Personal study, research and other noncommercial use are allowed; commercial use needs written permission.
- Original copy (the plain-language commentary on hexagrams and lines, verdicts and advice, interface text) and artwork: CC BY-NC-SA 4.0.
- Third-party content keeps its own license; see [NOTICE](NOTICE).

For traditional-culture reference and entertainment only. Not medical, legal or investment advice.
