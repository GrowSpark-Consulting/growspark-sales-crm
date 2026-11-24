import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Shared body of `pnpm org:set-details` and `pnpm staging:set-org-details`
 * (D84). The caller has already put the right DATABASE_URL into process.env;
 * the dynamic imports below happen only after that, for the same hoisting
 * reason every staging script documents.
 *
 *   --file <path>   JSON file with any of the organisation detail fields
 *   --org "<name>"  required only if the database holds more than one organisation
 *   --confirm       actually write; without it this is a dry run
 */
export async function runSetOrgDetails(argv: string[], targetLabel: string): Promise<void> {
  const fileIndex = argv.indexOf('--file');
  const filePath = fileIndex >= 0 ? argv[fileIndex + 1] : undefined;
  const orgIndex = argv.indexOf('--org');
  const orgName = orgIndex >= 0 ? argv[orgIndex + 1] : undefined;
  const confirm = argv.includes('--confirm');

  if (!filePath) {
    console.error('Usage: --file <path-to-json> [--org "<organisation name>"] [--confirm]');
    console.error('See apps/api/org-details.example.json for the accepted fields.');
    process.exit(1);
  }

  const { prisma } = await import('../../src/db/prisma.js');
  const { organizationDetailsSchema, applyOrganizationDetails } = await import('../../src/lib/organization-details.js');

  try {
    const raw: unknown = JSON.parse(readFileSync(resolve(process.cwd(), filePath), 'utf8'));
    const parsed = organizationDetailsSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('The file is not valid:');
      for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.') || '(file)'}: ${issue.message}`);
      process.exitCode = 1;
      return;
    }

    const organizations = await prisma.organization.findMany({ where: orgName ? { name: orgName } : {}, select: { id: true, name: true } });
    if (organizations.length !== 1) {
      console.error(
        organizations.length === 0
          ? `No organisation found${orgName ? ` named "${orgName}"` : ''}.`
          : `More than one organisation exists; pass --org "<name>" (found: ${organizations.map((org) => org.name).join(', ')}).`,
      );
      process.exitCode = 1;
      return;
    }
    const organization = organizations[0]!;

    console.log(`Target: ${targetLabel}`);
    console.log(`Organisation: ${organization.name}`);
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) console.log(`  ${key}: ${value === null ? '(clear)' : value}`);
    }

    if (!confirm) {
      console.log('\nDry run only — nothing was written. Re-run with --confirm to save these values.');
      return;
    }
    const changed = await applyOrganizationDetails(prisma, organization.id, parsed.data);
    console.log(changed.length > 0 ? `\nSaved ${changed.length} field(s).` : '\nNothing to change.');
  } finally {
    await prisma.$disconnect();
  }
}
