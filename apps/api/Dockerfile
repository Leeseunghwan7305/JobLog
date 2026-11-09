# JobLog API — pnpm 모노레포에서 apps/api만 빌드해 실행하는 이미지.
# 빌드 컨텍스트는 저장소 루트(context: .), 비밀은 런타임 env_file로만 주입.
FROM node:20-bookworm-slim AS base
# prisma 쿼리 엔진에 openssl 필요
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ── 빌드 단계: 워크스페이스 전체를 받아 api 빌드 ──
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @joblog/api exec prisma generate
RUN pnpm --filter @joblog/api build

# ── 실행 단계 ──
FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
# 시작 시 마이그레이션 반영(이미 적용돼 있으면 no-op) 후 서버 기동
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
