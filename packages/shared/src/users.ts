import { z } from 'zod';
import { ROLES } from './roles.js';
import { pageQuerySchema, paginationMetaSchema, sortQuerySchema, booleanQueryParam } from './common.js';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
  role: z.nativeEnum(ROLES),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be at most 128 characters'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long').optional(),
    role: z.nativeEnum(ROLES).optional(),
  })
  .refine((data) => data.name !== undefined || data.role !== undefined, {
    message: 'At least one of name or role must be provided',
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetUserPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be at most 128 characters'),
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

const USER_SORT_FIELDS = ['name', 'email', 'role', 'createdAt'] as const;

export const listUsersQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(USER_SORT_FIELDS),
  q: z.string().trim().min(1).optional(),
  role: z.nativeEnum(ROLES).optional(),
  isActive: booleanQueryParam.optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.nativeEnum(ROLES),
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;

export const usersListResponseSchema = z.object({
  data: z.array(userResponseSchema),
  meta: paginationMetaSchema,
});

/** GET /users/options — active users' id+name for owner pickers; any signed-in role may call it. */
export const userOptionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type UserOptionResponse = z.infer<typeof userOptionResponseSchema>;

export const userOptionsListResponseSchema = z.object({
  data: z.array(userOptionResponseSchema),
});
