import { hash, verify } from '@node-rs/argon2';

/**
 * @node-rs/argon2's library defaults (verified against its generated .d.ts):
 * algorithm Argon2id, version 0x13, memoryCost 19456 KiB, timeCost 2,
 * parallelism 1, outputLen 32 bytes. We use these defaults as-is — see
 * docs/decisions.md.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

/**
 * A fixed, precomputed argon2id hash of a password nobody will ever send.
 * Verifying a login attempt against this when no matching user exists means
 * an unknown email pays the same argon2 computation cost as a known one —
 * otherwise the response-time difference would reveal which emails exist,
 * even though the HTTP response itself never does.
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ArTYnYmvG9Cjl08rIglJqg$UqGPI/JFbvZAfgxzUjitlB/WHu9xs5x7YzXZhqx4PJc';

export async function verifyAgainstDummyHash(password: string): Promise<void> {
  await verify(DUMMY_PASSWORD_HASH, password);
}
