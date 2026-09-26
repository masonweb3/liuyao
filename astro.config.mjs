import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // canonical、og:image 等要绝对地址的标签靠它才会输出。
  site: 'https://sixyao.app',
  // 不用 Astro 的图片服务和 sessions，免得部署时多出 IMAGES、SESSION（KV）两个 binding。
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  vite: {
    // 字体小切片不要内联成 base64：内联进阻塞渲染的 CSS 里，每个页面都得先下载它们。
    build: { assetsInlineLimit: 0 },
  },
});
