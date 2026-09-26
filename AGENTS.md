# AGENTS.md

中国风六爻起卦网站。用户先写下所问，再摇六次铜钱成卦，程序排盘并断出吉凶，然后给出白话解读。TypeSafe **Jev** 负责语义判断：把问题分类到用神、做安全拦截。面向海外华人，免费、无广告、不登录。

立项调研和各项决策的依据见 `docs/research.md`，路线图见 `docs/roadmap.md`；`docs/` 只在本地，不进 git。上线后的变化和决定记在 `CHANGELOG.md`。本文件与它们冲突时，以本文件为准。

---

## 1. 硬性规则

1. **严禁在本机（开发用 Mac）搭测试环境。** 本机只用来编辑代码和执行 git。安装依赖、构建、跑测试、预览，一律到局域网测试服务器上做（见 §7）。
2. **许可：** 代码采用 PolyForm Noncommercial 1.0.0（`LICENSE.md`），项目对外称「源码公开、禁止商用」，**不说「开源软件」**。
   - 不引入 GPL、AGPL 或没有许可证的代码和数据。
   - 复制来的 MIT 代码要保留原版权声明，并在 `NOTICE` 里登记。
3. **版权内容：** 卦辞、爻辞、彖传、象传的原文属于公有领域，可以用。以下一律**禁止**：
   - 使用、改写或「参考着写」任何现代白话译注，例如黄寿祺、南怀瑾、傅佩荣的译注，以及各网站上的翻译；
   - 使用现代点校本的标点；
   - 批量抓取 ctext；
   - 使用 Wilhelm 英译本。
   白话解读必须由本项目**原创**撰写。
4. **密钥与环境信息：** `TYPESAFE_API_KEY` 只存在于服务端（Workers secret，或服务器上的 `.dev.vars`），绝不进入浏览器或 git。日志里不记录用户的问题原文。主机地址、账号、端口、代理这类环境信息只写在 `CLAUDE.local.md`（不进 git），**不许出现在任何被 git 跟踪的文件里**。
5. **安全红线：**
   - 识别到自伤倾向时停止起卦，显示求助资源：大陆 12356，海外 findahelpline.com。
   - 不预测彩票号码或赌博结果。
   - 不给医疗、法律、投资方面的结论。
   - 不写恐吓式断语，不出现「改命」「转运」「化解」等字样，不卖任何东西。
   - 不收集姓名、生辰、手机号或住址。
   - 结果页常驻一行说明：「AI 辅助判断 · 仅供传统文化参考与娱乐」。
6. **一事一占：** 同一个问题起卦后不能重摇。摇卦过程中不提供后退或重来入口。

## 2. 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Astro 7 + `@astrojs/cloudflare` | 页面全部预渲染，只有 `src/pages/api/judge.ts` 设 `export const prerender = false` |
| 运行时 | Cloudflare Workers（workerd） | `astro preview` 本身就跑在 workerd 上，测试环境与线上一致 |
| 前端交互 | 原生 TypeScript + Astro 组件 | **不引入 React、Vue 等框架**。起卦流程用一个简单的状态机实现 |
| 样式 | scoped CSS + `src/styles/tokens.css` 里的 CSS 变量 | 不用 Tailwind |
| 动画 | CSS 3D、WAAPI、SVG | 编排变复杂时可以加 GSAP（现已免费）。**不用** three.js、Lottie、Motion |
| 历法 | `tyme4ts` | 引擎唯一的运行时依赖 |
| 测试 | Vitest | 主要测引擎 |
| 包管理 | pnpm | Node 22 LTS |

「够用就好」：能用平台原生能力或几行代码解决的，就不加依赖；只有一个实现的东西，不要抽象成接口。

## 3. 目录

```
src/
  lib/liuyao/       纯 TS 排盘引擎，零 DOM，浏览器和测试都能直接跑
  lib/flow.ts       起卦流程的屏幕跳转表、Jev 结果的分流顺序、爻与铜钱的文字（零 DOM）
  lib/reading.ts    根据排盘结果和模板组装解读
  lib/history.ts    往卦的存取与「一事一占」判重（只存起卦输入，回看时重新排盘）
  components/       各屏的 Astro 组件：首屏、手动排盘、所问、择类、提示页、静心、摇卦、成卦、解读、往卦
  scripts/ritual.ts 起卦流程的状态机，驱动 index.astro 里的各屏
  scripts/card.ts   分享卡的 canvas 绘制（按需加载）
  scripts/sound.ts  音效：Web Audio 现场合成
  data/guaci.json   卦爻辞原文（维基文库转录，CC BY-SA 4.0，保持原文件和原协议）
  data/baihua.json  64 条卦辞白话（本项目原创，CC BY-NC-SA 4.0）
  data/templates.ts 断语和建议模板：（问题类别 × 吉/平/凶）
  pages/index.astro 首屏加完整起卦流程（单页）
  pages/api/judge.ts 唯一的服务端路由：调用 Jev
  styles/tokens.css 颜色、字体、间距、动效时长
  styles/fonts.css  首屏字形子集的 @font-face（生成文件）
  styles/webfonts.css fontsource 全部切片，异步加载
  fonts/            首屏字形子集（tools/subset-fonts.py 生成）
public/             og.png 分享预览图、robots.txt、_headers
tools/              开发脚本（在测试服务器的容器里跑）、og.png 的源
.github/workflows/  ci.yml：PR 上跑测试和构建；tag.yml：合并后打日期 tag
.coderabbit.yaml    CodeRabbit 审 PR 的设置
docs/               调研与路线图（本地，不进 git）
CHANGELOG.md        变更记录，版本号＝发布日期
README.md           英文说明；README.zh-CN.md 是中文版
```

有需要时再建新目录，不要预先搭空架子。

## 4. 六爻引擎（`src/lib/liuyao/`）

### 4.1 来源
装卦部分复制自 [TaoracleHQ/najia](https://github.com/TaoracleHQ/najia) 的 `const.ts`、`utils.ts`、`najia.ts`（MIT）。断卦部分自己写，旺衰、进退、伏神的规则可以参考 [mingpan](https://github.com/ChesterRa/mingpan)（Apache-2.0）。

### 4.2 起卦
- **铜钱：** 背面记 3，字面记 2。6 为老阴（×，动），7 为少阳，8 为少阴，9 为老阳（○，动）。随机数用 `crypto.getRandomValues`。
- **手动录入：** 支持直接输入六爻的数值，给专业用户用。

### 4.3 装卦（MVP 必须全部实现）
- 本卦、变卦、动爻
- 纳甲、卦宫五行、六亲、世应、六神、旬空
- 月建、日辰
- 伏神：本卦缺某个六亲时，取本宫八纯卦同一爻位的爻
- 用神
- 旺衰：月、日对用神的生扶克冲，月破，旬空
- 动爻：回头生克、进退神

### 4.4 已知陷阱（必须有对应测试）
- 变卦的六亲按**本卦**的宫来排。
- 游魂卦按世爻定宫：火地晋属乾宫。
- 干支按节气的**精确时刻**计算：
  - 2025-02-03 22:00 → 甲辰年丁丑月
  - 2025-02-03 22:20 → 乙巳年戊寅月
- 起卦时刻一律按 UTC+8 计算，与用户和服务器所在时区无关。
- 晚子时（23–24 点）是否换日做成选项，默认不换日。

### 4.5 用神映射（由代码完成，Jev 只负责给出类别）
| 问题类别 | 用神 |
|---|---|
| 财 | 妻财 |
| 事业、官司 | 官鬼 |
| 父母、房屋、文书、考试 | 父母 |
| 子女、医药 | 子孙 |
| 兄弟、朋友、竞争 | 兄弟 |
| 婚恋 | 男问取妻财，女问取官鬼。只在这一类下用两个按钮问性别 |
| 自身 | 世爻 |

### 4.6 吉凶
**完全由代码规则判定**，Jev 不参与。输出 `{ verdict: '吉'|'平'|'凶', reasons: string[] }`。`reasons` 是给专业用户看的依据，例如「用神妻财卯木临月建，旺」。

### 4.7 测试基准
- 《增删卜易》卦例 A–D，见 `docs/research.md` §3.4。
- taoracle 的 `test/fixtures/parity.json`：4096 组全量对照。
- 改动引擎时必须让这些测试全部通过。

## 5. Jev

- **调用时机：** 用户提交「所问」时，前端 `POST /api/judge`，调用**一次**。随后的静心环节（约 12 秒）正好盖住请求延迟。
- **写代码前**先读 https://docs.typesafe.ai/api.md 和 https://docs.typesafe.ai/primitives.md，确认当前的请求格式。
- **实现方式：** 用 `fetch` 直接调 `POST https://api.typesafe.ai/v1/systemone`，`model: "jev-latest"`。总超时 3 秒（`AbortSignal.timeout`）。不引入 SDK。
- **一次请求里的问题：** 下面五个问题都只依赖问题文本，所以放在同一个请求里并发：

| id | 题型 | 前端怎么用 |
|---|---|---|
| `topic` | Choice：财 / 事业 / 父母 / 子孙 / 兄弟 / 婚恋 / 自身 / 无法判断 | 映射到用神 |
| `self_harm` | Noul | 超过阈值时阻断起卦，显示求助资源 |
| `emergency` | Noul | 先显示提示「请先就医、报警或咨询律师」，用户确认后可以继续起卦 |
| `gambling` | Noul | 婉拒 |
| `sincere` | Noul | 过低时请用户换个说法重写 |

- **不在 Choice 里放「有害」选项。** 安全判断一律用 Noul。
- **阈值** 集中写在 `api/judge.ts` 顶部的常量里，并注明「初始值，待用真实问题集评估」。
- **失败回退：** 超时、出错、`topic` 置信度低于 0.6、或者没有配置 key，都让用户自己选类别。**没有 Jev 时，整条流程也必须能走通。**
- **限流：** `/api/judge` 使用 Cloudflare `ratelimit` binding 按 IP 限流，写法是 `env.RATE_LIMITER?.limit(...)`：本地没有这个 binding 时直接放行，保证测试环境不会因此报错。输入长度上限 200 字。
- **不许 Jev 做的事：** 生成文字、判吉凶、做五行生克推算。

## 6. 视觉与交互

- **风格：** 首屏和起卦用「夜色烫金」暗场；解读页和分享卡切到「宋式宣纸」纸色。从暗到纸的切换，就是从「问」到「答」的转场。
- **设计稿：** https://claude.ai/artifact/HHnTpBWmtBKHJ6kBtvsWh9（Claude Design：手机 12 块、桌面 8 块画板，附动效与桌面交互说明）。实现界面前先看对应画板。颜色、字体、时长以 `src/styles/tokens.css` 为准。
- **色值：**

| 用途 | 色名 | 色值 |
|---|---|---|
| 暗场底 | 燕颔蓝 | `#131824` |
| 暗场分层 | 鸽蓝 | `#1c2938` |
| 金 | 桂皮淡棕 | `#c09351` |
| 金色高光 | 浅驼色 | `#e2c17c` |
| 印章红 | 鹅血石红 | `#ab372f` |
| 纸底 | 汉白玉 | `#f8f4ed` |
| 纸上文字 | 牛角灰 | `#2d2e36` |
| 纸上次要文字 | 瓦灰加深 | `#6e665e`（原色 `#867e76` 对比度不够） |
| 线 | 珍珠灰 | `#e4dfd7` |
| 动爻标记 | 朱红 | `#ed5126`（只用于 ○ × 这类小标记，限纸面；暗场按设计稿用浅驼色） |

- **断语印章：** 吉用红底白字，平用墨色线框，凶用墨底白字。

- **字体：**
  - 正文用 Noto Serif SC（`@fontsource`）。
  - 卦名、标语、竖排文字用站酷小薇（`@fontsource/zcool-xiaowei`，OFL）。
  - 全部自托管，按 unicode-range 切片加载。
  - 首屏用到的字另打成小子集并预加载，fontsource 的切片声明异步加载，不阻塞首屏。改了首屏文案要重跑 `tools/subset-fonts.py`（用法见文件头）。
- **禁止：** 大红大金、龙纹、祥云素材、满屏八卦图、紫色星空、金色倒角高光、进度条。
- **流程：** 首屏 → 写下所问 → 静心 → 摇卦 ×6 → 成卦 → 解读。
  - 一屏只做一件事。
  - 已经写出的爻就是进度。
  - 所问一直以小字悬在屏幕顶部。
  - 各步骤的节奏见 `docs/research.md` §6.2。
- **动效：**
  - 只对 transform 和 opacity 做动画，不用大面积 blur 或 backdrop-filter。
  - 开启 `prefers-reduced-motion` 时去掉位移，但保留停顿。
- **手机和桌面都要做：**
  - 手机优先：用 `100dvh`，处理 safe-area，主按钮放在拇指够得到的区域。
  - ≥1024px 用桌面版式（设计稿 D1–D8）；768–1023px 沿用手机版式，内容居中，最宽 640px。
  - 桌面交互：Enter 落笔、Shift+Enter 换行；按住空格或鼠标摇卦，松开掷出；解读页左栏卦象与结论固定（sticky），右栏正文。
  - 摇一摇：手机上点「改用摇手机」开启（iOS 这时弹授权；传感器只在 https 下有数据），摇动手机即摇卦，停下掷出。摇不满 `--t-hold` 不算，防止拿起手机时误掷。
  - 震动：安卓按住时轻震、落定三连震；iOS 只有手指点到「摇」按钮上的透明开关时系统自带的一下（`Cast.astro` 的 `.tick`）。
- **音效：** 只有铜钱落盘和成卦磬声两段，用 Web Audio 现场合成（不带音频文件，不涉及授权），默认开启，首屏可以关掉。
- **分享卡：**
  - 在客户端用 canvas 生成，3:4，1242×1656。
  - 所问默认不上卡。
  - 用 `<img>` 展示，让用户长按保存。

## 7. 开发与测试流程（在局域网测试服务器上做）

- 测试服务器的地址、账号、已占用端口和网络情况写在 `CLAUDE.local.md`，开工前先读。下文的 `$STAGE` 指它的 SSH 目标。
- 代码目录：`~/liuyao`。测试地址：测试服务器的 4321 端口。

```sh
# 同步代码（在本机执行）
rsync -az --delete --exclude node_modules --exclude dist --exclude .astro --exclude .dev.vars --exclude .env.deploy --exclude .git --exclude CLAUDE.local.md --exclude .playwright-mcp ./ $STAGE:~/liuyao/
# 构建并启动预览（workerd）
ssh $STAGE 'cd ~/liuyao && docker compose up -d --build'
# 跑测试
ssh $STAGE 'cd ~/liuyao && docker compose run --rm app pnpm test'
```

- 容器镜像用 `node:22-bookworm-slim`。**不要用 alpine**：workerd 依赖 glibc。
- **加依赖**也在服务器上做，做完把三个文件拷回本机再提交：
  ```sh
  ssh $STAGE 'cd ~/liuyao && docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -v ~/liuyao:/app -w /app node:22-bookworm-slim corepack pnpm add <包名>'
  for f in package.json pnpm-lock.yaml pnpm-workspace.yaml; do scp $STAGE:liuyao/$f .; done
  ```
  pnpm 12 默认不跑依赖的构建脚本。确实需要时，在 `pnpm-workspace.yaml` 的 `allowBuilds` 里逐个放行。
- 服务器上的密钥放在 `~/liuyao/.dev.vars`，这个文件不进 git。`compose.yaml` 在运行时把它挂进容器，所以**没有 key 也要有这个文件，可以为空**，否则 `docker compose up` 会报挂载错误。
- Jev 评测（需要 key）：`ssh $STAGE 'cd ~/liuyao && docker compose run --rm app sh -c "set -a; . dist/server/.dev.vars; set +a; pnpm vitest run eval"'`
- 界面改动完成后，在测试地址上用浏览器看一遍，包括手机尺寸，再报告完成。

### 提交流程

所有改动都走 PR，`main` 有 ruleset 保护，不能直接推送。

1. 从 `main` 开分支，在测试服务器上改完、测完。
2. 推送分支，开 PR 到 `main`。推分支、开 PR 不用另外请示。
3. CI（`.github/workflows/ci.yml` 的 `test`：`pnpm test` + `pnpm build`）必须通过。CodeRabbit 对不满 10 星的仓库不自动审，开 PR 后评论 `@coderabbitai review` 触发；意见逐条处理或回复理由。它的状态不是必过项：免费版有限流，不能让它卡住合并。
4. 由项目负责人合并（squash）。**合并就是上线**，见 §8。

## 8. 部署

生产环境部署到 Cloudflare Workers，域名 `sixyao.app`（Cloudflare 注册）。它同时写在 `astro.config.mjs` 的 `site`（canonical、og:image 等绝对地址靠它）和 `wrangler.jsonc` 的 `routes`（绑定自定义域名），改域名两处一起改。
- **合并到 `main` 即自动部署**：Worker `liuyao` 接了 Cloudflare Workers Builds，构建命令 `pnpm build`，部署命令 `npx wrangler deploy`。只有 `main` 触发，其他分支不构建（测试环境仍是局域网服务器）。构建变量 `NODE_VERSION`、`PNPM_VERSION` 在 Cloudflare 后台设，改 Node 或 pnpm 大版本时和 `package.json`、`ci.yml` 一起改。
- 生产密钥用 `wrangler secret put TYPESAFE_API_KEY` 设置。
- 应急时可以从测试服务器手动部署，命令和凭据见 `CLAUDE.local.md`。部署凭据不要放进 `.dev.vars`：那个文件存的是 Worker 自己的变量。

每次部署都在 `CHANGELOG.md` 记一条：版本号用部署当天的北京时间日期 `YYYY.MM.DD`，同一天多次部署并入当天那条。写用户看得到的变化，以及以后改代码时需要知道的决定和原因。这一条**写在 PR 里**，日期按预计合并的那天；拖到别的日子才合并，合并前改过来。同名 annotated tag 由 `.github/workflows/tag.yml` 在合并后自动打，同一天再合并会把 tag 移到新提交。

未经项目负责人同意，不要合并 PR，不要手动部署生产环境。

## 9. 文案与代码风格

- **界面文案**：简体中文，文雅、克制、短句。不堆砌术语。专业信息折叠在「完整盘面」里。
- **代码**：TypeScript strict 模式。注释只解释「为什么」。命名用英文。六爻术语在代码里用拼音或英文，第一次出现时注上中文，例如 `yongShen // 用神`。
- **测试**：引擎和解读组装必须有测试；纯展示组件不写测试。
