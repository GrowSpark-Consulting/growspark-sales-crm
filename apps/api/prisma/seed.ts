import { runSeed } from './seed-lib.js';
import { prisma } from '../src/db/prisma.js';

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file present; rely on whatever is already in the environment.
}

runSeed()
  .then(() => console.log('seed: done'))
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
