

## Problem

Currently, when the recipient clicks "✅ Ya actualicé" in the email, the record is immediately marked as `responded = true`. The user (admin) has no way to distinguish between a self-reported confirmation from the recipient vs. a verified confirmation. The recipient could be lying.

## Solution: Two-step confirmation flow

Add a `confirmed` boolean field to `notification_emails`. The flow becomes:

1. Recipient clicks email button → `responded = true` (self-reported)
2. Admin reviews and manually checks → `confirmed = true` (verified)

### Database Migration

Add two columns to `notification_emails`:
- `confirmed` (boolean, default false) — admin's manual verification
- `confirmed_at` (timestamptz, nullable) — when admin confirmed

### Edge Function: `mark-email-responded`

No changes needed — it already only sets `responded = true`.

### UI Changes

**`NotificationSection.tsx`** (topic card):
- Show three states: Pendiente (no response), "Dice que respondió" (responded but not confirmed, yellow/amber), "Confirmado" (green)
- The existing checkbox becomes the admin confirmation toggle (`confirmed`), separate from the recipient's self-report (`responded`)

**`EmailHistoryView.tsx`**:
- Add a "Confirmado" column with a checkbox for admin to confirm
- Show status as: Pendiente → "Auto-reportado" (amber badge) → "Confirmado" (green check)
- Update filter to include: Todos / Pendientes / Auto-reportados / Confirmados
- Update stats to show 4 categories

**`useNotificationEmails.tsx`**:
- Update `NotificationEmail` interface to include `confirmed` and `confirmed_at`
- Add `toggleConfirmed` mutation
- Keep existing `toggleResponded` for the recipient's self-report (via email button)

### Visual States

```text
State 1: responded=false, confirmed=false → "Pendiente" (gray)
State 2: responded=true,  confirmed=false → "Por confirmar" (amber/yellow)  
State 3: responded=true,  confirmed=true  → "Confirmado" (green)
State 4: responded=false, confirmed=true  → "Confirmado" (green, admin override)
```

### Summary of Changes

1. **Migration**: Add `confirmed` + `confirmed_at` columns
2. **`useNotificationEmails.tsx`**: Add `confirmed`/`confirmed_at` to interface, add `toggleConfirmed` mutation
3. **`NotificationSection.tsx`**: Show recipient response status + admin confirmation checkbox separately
4. **`EmailHistoryView.tsx`**: Add confirmation column, update filters/stats for the new states

