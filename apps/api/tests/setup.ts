try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file present; rely on whatever is already in the environment.
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
