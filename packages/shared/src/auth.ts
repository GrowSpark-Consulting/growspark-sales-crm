import { z } from 'zod';
import { ROLES } from './roles.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  // Deliberately no min/max length policy here: this validates an *existing*
  // password at login, not a new one. A short or long guess must still reach
  // the generic 401 (and the dummy-hash timing defense), not fail validation
  // first and reveal that a length check ran before a credential check.
  password: z.string().min(1, 'Password is required').max(1024, 'Password is too long'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(1024),
  newPassword: z
    .string()
    .min(10, 'New password must be at least 10 characters')
    .max(128, 'New password must be at most 128 characters'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.nativeEnum(ROLES),
  }),
  organization: z.object({
    name: z.string(),
    timezone: z.string(),
    currency: z.string(),
  }),
  permissions: z.array(z.string()),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
