# Alert

An inline message inside a page or form that explains something the user needs to know or fix.

- Soft background (`info-soft`, `success-soft`, `warning-soft`, `danger-soft`), icon in the strong tone, text in `ink` for maximum readability.
- First sentence bold: what happened. Second: what to do next.
- `role="alert"` for errors, `role="status"` for the rest.
- For short-lived confirmations ("Saved") use a toast (`shadow-md`, bottom-right, 4 seconds) instead.
- No exclamation marks, no blame ("You entered…" → "Phone number is missing").
