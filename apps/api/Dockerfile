# Single-stage image: the whole monorepo is installed and built inside this
# image, and the final container still has the full workspace + devDependencies
# on disk. This is a deliberate simplicity-over-image-size tradeoff for a
# local/demo "docker compose --profile full up" — not a production-minimised
# image (see docs/decisions.md for the full reasoning). Build context must be
# the repo root (docker-compose.yml sets this), so this file can reach
# packages/shared and the other workspace packages.
#
# Everything is copied in before `pnpm install`, not split into a
# dependency-only layer first: the root package.json's own "prepare" script
# (pnpm --filter @growspark/shared build && prisma generate) runs
# automatically as part of `pnpm install` itself, and needs the real source
# of packages/shared and apps/api/prisma already present to succeed — found
# by actually running this build, not assumed.
FROM node:22.20.0-bookworm-slim

WORKDIR /app

# Pin pnpm the same way the rest of this repo does (packageManager field) —
# `corepack enable` is safe here because we own this image's filesystem
# entirely (unlike Render's shared build image, see docs/decisions.md D70).
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

# Prisma's engine postinstall needs OpenSSL to detect the right engine build;
# bookworm-slim doesn't ship it by default (confirmed by Prisma's own
# postinstall warning when this image was first built without it).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# `pnpm install`'s own "prepare" lifecycle script runs `prisma generate`,
# which needs DATABASE_URL to resolve as *some* valid-looking connection
# string (prisma.config.ts's PrismaConfigEnvError otherwise) even though
# `generate` never actually connects to a database — only reads
# schema.prisma. A placeholder here, never used for a real connection, is
# the fix: real .env files are deliberately excluded from this image
# (.dockerignore) and must never be relied on at build or run time. The
# real DATABASE_URL (crm_docker) is set by docker-compose.yml's own
# `environment:` at container *run* time, which always overrides this.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build_placeholder

COPY . .
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @growspark/shared build \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api build

WORKDIR /app/apps/api
EXPOSE 4000

# Migrations are additive/idempotent (`prisma migrate deploy`, never
# `migrate reset`/`dev`) — safe to run on every container start. The seed is
# also idempotent (upserts by unique email, docs/decisions.md D15) and only
# ever targets this image's own isolated database (DATABASE_URL points at
# crm_docker, never crm_dev — see docker-compose.yml and docs/decisions.md):
# running it on every start is what gives a reviewer a working demo login
# without a manual step, and can never touch a developer's real local data.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm db:seed && node dist/index.js"]
