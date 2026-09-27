# 六爻 · liuyao

**[sixyao.app](https://sixyao.app)** · [English](README.md)

中国风六爻起卦网站。写下所问，静心，摇六次铜钱，成卦，读解。

- **排盘由程序完成**：纳甲、六亲、世应、六神、旬空、伏神、旺衰都是确定性计算，同一卦永远排出同一盘，并用《增删卜易》卦例和 4096 组全量对照做测试。
- **吉凶由规则判定**，并列出依据，不交给模型。
- **语义判断用 [TypeSafe Jev](https://docs.typesafe.ai)**：给问题分类以确定用神，并识别自伤、急事、赌博等不宜占问的情况。Jev 不可用时由用户自选类别，流程照样走得通。
- **解读**：卦爻辞原文，加本项目原创的白话。
- **手机上**可以长按「摇」，也可以开启摇一摇，直接摇手机。
- **免费、无广告、不登录。** 访问量只用 Cloudflare Web Analytics 统计：不用 cookie，不追踪个人，不接其他统计。往卦只存在本机浏览器。所问只发给 Jev 分类一次，本站不记录。

## 技术栈

Astro 7 · Cloudflare Workers · TypeScript · [tyme4ts](https://github.com/6tail/tyme4ts)（历法） · Vitest。页面全部预渲染，唯一的服务端路由是调用 Jev 的 `/api/judge`。

## 开发

- [AGENTS.md](AGENTS.md)：开发规范（人和 AI 代理都要遵守）
- [CHANGELOG.md](CHANGELOG.md)：每次发布的变化，版本号即发布日期

## 许可

本项目**源码公开（source-available），禁止商业使用**，不属于 OSI 定义的开源软件。

- 代码：[PolyForm Noncommercial License 1.0.0](LICENSE.md)。允许个人学习、研究和其他非商业用途；商业使用须另外取得书面授权。
- 原创文案（卦辞与爻辞的白话、断语与建议、界面文案）与美术资源：CC BY-NC-SA 4.0。
- 第三方内容按各自的许可，见 [NOTICE](NOTICE)。

本站内容仅供传统文化参考与娱乐，不构成医疗、法律或投资建议。
