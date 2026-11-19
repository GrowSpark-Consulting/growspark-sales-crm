# StatCard

A KPI tile for dashboards: label, big number, and one line of context.

- Card: `surface`, 1px `line` border, `radius-lg`, `shadow-sm`, padding `space-5`.
- Label 13px `ink-muted`; value 28px/600 with tabular numbers; delta 13px.
- Delta colour: `success` when the change is good, `danger` when bad — judge by meaning, not direction (more overdue tasks = danger).
- Indian number formatting for money: ₹ 4,82,000 or ₹ 48.2 L / ₹ 1.2 Cr.
- 3–4 cards per row on dashboards; never more than 6 KPIs on one screen.
