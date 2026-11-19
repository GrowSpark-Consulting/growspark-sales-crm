# Table

The main way records are shown in all three products: leads, tasks, employees.

- Header row: `surface-sunken`, 13px/500 `ink-muted`, sentence case. Sticky on scroll (`z-sticky`).
- Rows: `row-height` 44px (compact mode 36px), 1px `line` separators, no zebra stripes.
- Hover: `surface-hover`. Selected: `primary-soft`.
- Numbers and money right-aligned with tabular figures; text left-aligned.
- First column is the record name (with avatar for people) and opens the record.
- Secondary info (company, email) in `ink-muted` 13px.
- Row actions: a ghost icon button (⋯) at row end, visible on hover and on keyboard focus.
- Empty state: centred message + one primary action ("No leads yet — Add your first lead").
- Pagination or "Load more" at the bottom; default 25 rows.
