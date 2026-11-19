# Button

Buttons trigger an action; use one primary button per screen region, for the thing that region is for.

| Variant | Class | When |
|---|---|---|
| Primary | `gs-btn gs-btn-primary` | The main action: "New lead", "Save", "Approve leave". Max one per card/modal/toolbar. |
| Secondary (default) | `gs-btn` | Everything else: Export, Filter, Edit. |
| Ghost | `gs-btn gs-btn-ghost` | Low-emphasis: Cancel, toolbar icon buttons, "View all". |
| Danger | `gs-btn gs-btn-danger` | Destructive: Delete, Reject, Terminate. Always confirm in a modal. |
| Small | add `gs-btn-sm` | Inside table rows and dense toolbars (`control-sm`, 30px). |

- Height `control-md` (36px), radius `radius-md`, text 14px/500.
- Label = verb first, sentence case: "Add employee", not "ADD EMPLOYEE" or "Employee Add".
- Icon (18px, Lucide) on the left only, and only when it helps scanning.
- Loading: keep width, disable, change label to "Saving…".
- Focus: 2px `focus-ring` outline, 2px offset — never remove it.
- Never use `accent` (clay) for buttons; clay is reserved for brand moments.
