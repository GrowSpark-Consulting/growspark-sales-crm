/**
 * React Hook Form initialises every text field to "" (not undefined), so a
 * submit always sends a key for every optional field even when the user
 * left it blank. Sent as-is, that becomes a real empty string in the
 * request body — which a create endpoint stores literally (its `?? null`
 * fallback only replaces null/undefined, not ""), and which
 * `z.coerce.number()` coerces to `0`, not "not provided". Stripping blank
 * optional fields before the request keeps "untouched" meaning the same
 * thing in the UI as it already does when calling the API directly.
 */
export function stripEmptyOptionalFields<T extends Record<string, unknown>>(values: T): T {
  const result = { ...values };
  for (const key of Object.keys(result)) {
    if (result[key] === "") {
      delete result[key];
    }
  }
  return result;
}
