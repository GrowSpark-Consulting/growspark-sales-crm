# Pipeline reconciliation — 2026-11-21

Compared the independent SQL in `docs/MANUAL-TEST-DAY3.md` §3.4 against authenticated `GET /api/v1/pipeline/summary` for the seeded organisation in `crm_dev`.

```sql
SELECT COUNT(*), SUM(value), SUM(value * probability / 100.0)
FROM deals
WHERE organization_id = (SELECT id FROM organizations LIMIT 1)
  AND archived_at IS NULL AND status = 'OPEN';
```

| Source | Count | Value | Weighted value |
|---|---:|---:|---:|
| SQL (`docker exec ... psql`) | 1 | 56677.00 | 14169.250000000000 |
| `GET /api/v1/pipeline/summary` | 1 | 56677 | 14169.25 |

**Result: match.** PostgreSQL and the endpoint return the same exact numeric values; the endpoint serializes equivalent decimals without trailing zeroes.