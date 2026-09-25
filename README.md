# 六爻 · liuyao

中国风六爻起卦网站。写下所问，静心，摇六次铜钱，成卦，读解。

- **排盘由程序完成**：纳甲、六亲、世应、六神、旬空、伏神、旺衰都是确定性计算，同一卦永远排出同一盘，并用《增删卜易》卦例和 4096 组全量对照做测试。
- **语义判断用 [TypeSafe Jev](https://docs.typesafe.ai)**：给问题分类以确定用神，并识别自伤、赌博等不宜占问的情况。吉凶由规则判定，不交给模型。
- **解读**：卦爻辞原文，加本项目原创的白话。

> 状态：开发中，尚未上线。路线图见 [docs/roadmap.md](docs/roadmap.md)。

## 文档
- [AGENTS.md](AGENTS.md)：开发规范（人和 AI 代理都要遵守）
- [docs/research.md](docs/research.md)：立项调研
- [docs/roadmap.md](docs/roadmap.md)：MVP 路线图

## 技术栈
Astro 7 · Cloudflare Workers · TypeScript · tyme4ts · Vitest

## 许可
本项目**源码公开（source-available），禁止商业使用**，不属于 OSI 定义的开源软件。

- 代码：[PolyForm Noncommercial License 1.0.0](LICENSE.md)。允许个人学习、研究和其他非商业用途；商业使用须另外取得书面授权。
- 原创文案与美术资源：CC BY-NC-SA 4.0。
- 第三方内容按各自的许可，见 [NOTICE](NOTICE)。

本站内容仅供传统文化参考与娱乐，不构成医疗、法律或投资建议。
