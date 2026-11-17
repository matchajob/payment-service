# syntax=docker/dockerfile:1.7
FROM node:22.22-bookworm-slim AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
# @matcha/infra is a private GitHub dependency fetched over SSH; GitHub's published host key is pinned, not scanned.
RUN mkdir -p -m 0700 /root/.ssh \
  && echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > /root/.ssh/known_hosts
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json packages/sdk/
RUN --mount=type=ssh pnpm install --prod --frozen-lockfile

FROM node:22.22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/api/server.ts"]
