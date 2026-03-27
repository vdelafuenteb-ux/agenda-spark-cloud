

## Plan: Quitar auto-confirmación de correos "tema nuevo" + confirmar al enviar actualización

### Problema actual
Cuando se envía un correo de tema nuevo, en `NotificationSection.tsx` se muestra siempre un check verde fijo con "Notificado" — no permite al admin confirmar/desconfirmar manualmente. Además, cuando el responsable envía su actualización vía el link, la función `submit-update` solo marca `responded = true` pero NO marca `confirmed = true`.

### Cambios

**1. `src/components/NotificationSection.tsx` — Tratar correos new_topic igual que weekly**
- Eliminar la rama `isNewTopic` que mostraba un check verde fijo. Usar la misma lógica de confirmación que los correos semanales (checkbox/ConfirmPopover)
- Mantener el badge "Tema nuevo" para distinguirlos visualmente

**2. `supabase/functions/submit-update/index.ts` — Auto-confirmar al enviar actualización**
- Cuando el responsable envía su actualización (y hay cambios), además de marcar `responded = true`, también marcar `confirmed = true` y `confirmed_at = now()` en los `notification_emails` correspondientes
- Esto sincroniza automáticamente el estado tanto en la tarjeta como en el historial

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/NotificationSection.tsx` | Eliminar rama `isNewTopic` auto-confirmada, usar misma lógica de checkbox |
| `supabase/functions/submit-update/index.ts` | Agregar `confirmed: true, confirmed_at` al update de `notification_emails` |

