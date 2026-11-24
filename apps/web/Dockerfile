# Single-stage image, same tradeoff as apps/api/Dockerfile — see the comment
# there and docs/decisions.md. Build context must be the repo root. Everything
# is copied in before `pnpm install` for the same "prepare" lifecycle-script
# reason explained in apps/api/Dockerfile (this image needs apps/api/prisma
# present too, only because the root package.json's "prepare" script runs
# prisma generate unconditionally on every install — its output is unused
# here, but install still needs to find it).
FROM node:22.20.0-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

# A root-level `pnpm install` installs every workspace member's dependencies,
# including apps/api's Prisma — not just this image's own apps/web — so the
# same OpenSSL fix apps/api/Dockerfile needs applies here too even though
# this app never calls Prisma itself.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# Same placeholder-DATABASE_URL reasoning as apps/api/Dockerfile — the
# workspace-wide `pnpm install` triggers apps/api's `prisma generate` here
# too, which needs DATABASE_URL to resolve as *some* connection string even
# though this image never uses Prisma or a database itself.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build_placeholder

# Must be set BEFORE `next build`, not only at container run time: found by
# actually running this image — `docker-compose.yml`'s `environment:` only
# applies once a container starts, but `next.config.ts`'s rewrites() reads
# process.env.API_INTERNAL_URL once and Next's production build serialises
# the result into the build output. Setting the real runtime value as a
# container environment variable later has no effect on an already-built
# .next — the container kept trying to proxy to its own localhost:4000
# (next.config.ts's fallback, baked in at build time) and failing with
# ECONNREFUSED, even though the correct env var was genuinely present at
# container start. This is always "http://api:4000" for this compose setup
# — the Compose service name and the api container's own internal port,
# neither of which DOCKER_API_PORT (the host-published port) changes.
ENV API_INTERNAL_URL=http://api:4000

COPY . .
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @growspark/shared build \
 && pnpm --filter web build

WORKDIR /app/apps/web
EXPOSE 3000

CMD ["pnpm", "start"]
