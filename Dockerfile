# workerd 依赖 glibc，不能用 alpine
FROM node:22-bookworm-slim
ENV ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Cloudflare 适配器构建时在 localhost 起预渲染服务；容器里 localhost 两种解析不一致会连不上，统一用 IPv4
ENV NODE_OPTIONS=--dns-result-order=ipv4first
# workerd 用系统证书库校验 TLS（Node 自带证书，slim 镜像没有），否则调不通外部 HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 4321
CMD ["pnpm", "preview"]
