

## Problem

The **Historial Correos** view and the **NotificationSection** (in each topic card) use different React Query keys and don't invalidate each other's caches:

- `useNotificationEmails` hook uses query key `['notification_emails', topicId]` and invalidates `['notification_emails']`
- `EmailHistoryView` uses query key `['notification_emails_all']` and only invalidates `['notification_emails_all']` + `['notification_emails']`

When you toggle responded or delete from the topic card (NotificationSection), it invalidates `['notification_emails']` but **not** `['notification_emails_all']`, so the Historial view stays stale. The reverse direction (Historial → topic card) does work partially since EmailHistoryView invalidates both keys.

## Plan

### 1. Unify query key invalidation in `useNotificationEmails` hook

Update `onSuccess` callbacks for `deleteEmail`, `toggleResponded`, and `logEmail` to also invalidate `['notification_emails_all']` so the Historial view refreshes when actions happen from topic cards.

### 2. Ensure EmailHistoryView invalidations cover topic-specific keys

The EmailHistoryView already invalidates `['notification_emails']` which should match all topic-specific queries via partial matching. Verify this works correctly.

### Changes

**`src/hooks/useNotificationEmails.tsx`** — In all three mutations (`logEmail`, `deleteEmail`, `toggleResponded`), add `queryClient.invalidateQueries({ queryKey: ['notification_emails_all'] })` to the `onSuccess` handler alongside the existing invalidation.

This ensures bidirectional sync: actions in either view refresh both caches.

