/** "user.role_changed" -> "User role changed" — purely cosmetic, the raw action is still shown in the filter. */
export function auditActionLabel(action: string): string {
  const [entity, ...rest] = action.split(".");
  const verb = rest.join(" ").replace(/_/g, " ");
  if (!entity) return action;
  return `${entity.charAt(0).toUpperCase()}${entity.slice(1)} ${verb}`.trim();
}

/** Only entity types with a real detail page get a link; everything else just shows its type and a short id. */
const ENTITY_DETAIL_PATH: Record<string, string> = {
  lead: "/leads",
  company: "/companies",
  contact: "/contacts",
  deal: "/deals",
  websiteSubmission: "/form-submissions",
};

export function auditEntityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  const base = ENTITY_DETAIL_PATH[entityType];
  return base ? `${base}/${entityId}` : null;
}

export function shortId(id: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
