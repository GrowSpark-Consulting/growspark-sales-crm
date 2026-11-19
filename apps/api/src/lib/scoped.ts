import type { RequestContext } from './context.js';

/**
 * The organisation filter every query must apply. Centralised so the
 * pattern is hard to forget or spell differently in different modules.
 */
export function scoped(ctx: RequestContext): { organizationId: string } {
  return { organizationId: ctx.orgId };
}
