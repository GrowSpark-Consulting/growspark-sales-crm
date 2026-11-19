import { describe, expect, it } from 'vitest';
import { loginSchema, changePasswordSchema } from '@growspark/shared';

describe('loginSchema', () => {
  it('trims and lowercases the email', () => {
    const result = loginSchema.parse({ email: '  Foo@Example.COM  ', password: 'anything' });
    expect(result.email).toBe('foo@example.com');
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('accepts a short password (login does not enforce the new-password policy)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('rejects a new password shorter than 10 characters', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success,
    ).toBe(false);
  });

  it('rejects a new password longer than 128 characters', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'x'.repeat(129) })
        .success,
    ).toBe(false);
  });

  it('accepts a 10-128 character new password', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'x'.repeat(10) })
        .success,
    ).toBe(true);
  });
});
