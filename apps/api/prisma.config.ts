import { defineConfig, env } from 'prisma/config';

try {
  process.loadEnvFile(new URL('./.env', import.meta.url));
} catch {
  // No .env file present (e.g. CI with env vars already set) — ignore.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
