/**
 * The organisation filter every query must apply. Centralised so the
 * pattern is hard to forget or spell differently in different modules.
 *
 * Takes the narrowest shape that has an `orgId` (not the full
 * `RequestContext`) so API-key-authenticated code paths (the intake
 * endpoint — no human user, no role) can call this and the duplicate
 * finders below with a plain `{ orgId }` object instead of a fabricated
 * fake `RequestContext`. Every real `RequestContext` already satisfies this
 * shape structurally, so no existing call site changes.
 */
export function scoped(ctx: { orgId: string }): { organizationId: string } {
  return { organizationId: ctx.orgId };
}
