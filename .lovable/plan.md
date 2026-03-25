

## Plan: Fix assignee table logic consistency

The problem: in the assignee ranking logic, topics without a due date or marked as "ongoing" are not counted in any deadline column (al día / atrasados / por vencer), so the numbers don't add up. Per your rule: those should count as "al día". Also, "Total" currently includes completed topics but should only show activo + seguimiento + pausado.

### Changes in `src/components/DashboardView.tsx`

**Assignee map logic (lines 182-206):**

1. Change `total` to only count non-completed topics (activo + seguimiento + pausado)
2. Topics with `is_ongoing` or no `due_date` → count as `onTrackCount` (al día) instead of being skipped
3. This ensures: `onTrackCount + overdueCount + dueSoonCount === activeCount` for each assignee

```
// Before (broken):
if (t.is_ongoing || !t.due_date) {
  // no deadline status  ← DROPPED, not counted anywhere
}

// After (fixed):
if (t.is_ongoing || !t.due_date) {
  entry.onTrackCount++;  ← counted as "al día"
}
```

And for `total`: only increment when status is not `completado`.

**No other files affected.** The semáforo KPI card already works correctly via subtraction.

