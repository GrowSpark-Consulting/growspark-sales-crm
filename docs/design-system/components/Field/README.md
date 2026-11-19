# Field

A text input with its label above, optional helper text below, and an error state.

Structure: `label.gs-field > span.gs-label + input.gs-input + span.gs-help`. Add `gs-field-error` to the wrapper and `aria-invalid="true"` to the input for errors.

- Label always visible above the field — never use the placeholder as the label.
- Placeholder shows an example in `ink-muted` ("e.g. 98400 12345").
- Border `line-strong` (meets 3:1); hover darkens to `ink-muted`; focus = `primary` border + `focus-ring` outline.
- Error: `danger` border, `danger-soft` fill, helper text turns `danger` and says how to fix it ("Enter a 10-digit mobile number"), not just "Invalid".
- Selects, date pickers, textareas and search use the same height, border, radius and states.
- Required fields: mark the *optional* ones "(optional)" instead of adding red asterisks everywhere.
- Group related fields in a two-column grid on desktop with `space-4` gaps; one column under 720px.
