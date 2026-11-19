# Sidebar

The left navigation rail shared by all three products — the one deep, dark block that makes them feel like a family.

- Background `sidebar` (deep espresso, also in light theme); labels `on-sidebar`, section headings `on-sidebar-muted` 12px uppercase.
- Width `sidebar-width` (240px), collapses to a 64px icon rail.
- Header: product chip + product name. The chip is the ONLY place a product colour appears:
  - Sales & CRM → `product-sales` (clay), letter "S"
  - Project Management → `product-projects` (moss), letter "P"
  - HR & People → `product-people` (slate), letter "H"
- Nav item: 36px tall, `radius-md`, icon 18px + label; current page uses `sidebar-active` fill and `aria-current="page"`.
- Max ~8 top-level items; group the rest under section headings.
- A product switcher (to jump between Sales, Projects and People) lives in the header chip's dropdown.
