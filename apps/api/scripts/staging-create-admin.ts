import { z } from 'zod';
import { createUserSchema } from '@growspark/shared';
import { loadStagingEnv } from './lib/load-staging-env.js';
import { promptHidden, promptText } from './lib/prompt.js';

loadStagingEnv();

// Dynamic imports, not static ones: a static `import` is hoisted above
// loadStagingEnv() above, which would make src/env.js (and the prisma
// singleton it feeds) capture process.env before the staging file is
// loaded into it — the same reasoning as tests/setup.ts's own comment.
const { prisma } = await import('../src/db/prisma.js');
const { seedBaselineOrganization } = await import('../prisma/seed-lib.js');
const { createFirstAdmin } = await import('../src/lib/bootstrap-admin.js');

const adminInputSchema = z.object({
  name: createUserSchema.shape.name,
  email: createUserSchema.shape.email,
  password: createUserSchema.shape.password,
});

async function promptForAdmin(): Promise<z.infer<typeof adminInputSchema>> {
  for (;;) {
    const name = await promptText('Name: ');
    const email = await promptText('Email: ');
    const password = await promptHidden('Password: ');

    const parsed = adminInputSchema.safeParse({ name, email, password });
    if (parsed.success) {
      return parsed.data;
    }

    console.error('\nInvalid input:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('Try again.\n');
  }
}

async function main(): Promise<void> {
  console.log('Create the first Admin for staging.');
  console.log('(No password is ever accepted as a command-line argument — it is only read from this prompt.)\n');

  const input = await promptForAdmin();
  const organization = await seedBaselineOrganization();
  const admin = await createFirstAdmin({
    organizationId: organization.id,
    name: input.name,
    email: input.email,
    password: input.password,
  });

  console.log(`\nCreated Admin ${admin.email} (${admin.id}) in organisation "${organization.name}" (${organization.id}).`);
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
