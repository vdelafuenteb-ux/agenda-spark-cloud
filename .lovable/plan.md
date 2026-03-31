

## Plan: Fix silent save failures + race conditions in topic updates

### Root cause found

The `updateTopic` mutation in `useTopics.tsx` has **no error feedback**. When the DB update fails (network issue, timeout, etc.):
1. The optimistic update shows the change immediately
2. The actual `.update()` call to the DB fails silently
3. `onError` rolls back the UI to the previous state
4. `onSettled` refetches from DB, confirming the old data
5. **The user never sees any error** — it just looks like the change "disappeared"

This explains the user's experience: they changed an assignee, it appeared to work, but on reload the old value was back.

### Changes

**1. `src/hooks/useTopics.tsx` — Add error toast to `updateTopic`**
- Import `toast` from sonner
- Add `onError` handler that shows `toast.error('Error al guardar cambios')` in addition to the optimistic rollback
- Do the same for `toggleSubtask`, `updateSubtask`, `deleteSubtask`, `deleteTopic` — any mutation with optimistic updates

**2. `src/hooks/useTopics.tsx` — Prevent race conditions on rapid updates**
- The current `onMutate` calls `cancelQueries` which cancels in-flight refetches from previous mutations' `onSettled`. This is correct React Query pattern.
- But if two `updateTopic.mutate()` calls fire in quick succession, the second `onMutate`'s `previous` captures the first's optimistic state (not the real DB state). If the first mutation then fails, `onError` rolls back to wrong baseline.
- Fix: no structural change needed, but ensure `onSettled` always refetches (already does via `invalidateTopics`).

**3. `src/pages/Index.tsx` — line 540-544 race condition**
- When status changes to `completado`, the handler fires `updateTopic.mutate()` AND multiple `toggleSubtask.mutate()` simultaneously. Each triggers `cancelQueries(['topics'])` which can cancel each other's refetches.
- Fix: use `mutateAsync` + `await` for the topic update before toggling subtasks, OR remove the client-side subtask toggling (it's already handled by the `auto_complete_subtasks_on_topic_close` trigger in the DB).

### Key fix detail
The DB already has a trigger `auto_complete_subtasks_on_topic_close` that marks subtasks as completed when a topic closes. The duplicate client-side code at line 540-544 is unnecessary and causes race conditions. Removing it eliminates a source of conflicts.

### Files affected

| File | Change |
|---|---|
| `src/hooks/useTopics.tsx` | Add `toast.error()` on all optimistic mutation failures |
| `src/pages/Index.tsx` | Remove redundant subtask toggling on topic close (DB trigger handles it) |

