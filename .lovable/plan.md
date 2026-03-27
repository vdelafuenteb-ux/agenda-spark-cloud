

## Plan: Agregar columna "Revisado" (checkbox) a correos — sincronizada entre historial y tarjetas

### Cambio

Agregar campo `reviewed` (boolean) a `notification_emails` para que el admin pueda marcar cada correo como revisado después de que el responsable envió su actualización.

### 1. Migración BD
- `ALTER TABLE notification_emails ADD COLUMN reviewed boolean NOT NULL DEFAULT false`
- `ALTER TABLE notification_emails ADD COLUMN reviewed_at timestamptz DEFAULT NULL`

### 2. `src/hooks/useNotificationEmails.tsx`
- Agregar `reviewed`, `reviewed_at` al interface `NotificationEmail`
- Agregar mutación `toggleReviewed({ id, reviewed })` que actualiza `reviewed` y `reviewed_at`

### 3. `src/components/EmailHistoryView.tsx`
- Agregar `reviewed` al `EmailRecord` interface
- En ambas sub-pestañas (masivos y nuevos temas), agregar columna "Revisado" con checkbox
- Al marcar/desmarcar, llamar mutación `toggleReviewed`
- Agregar filtro de estado "Revisado / No revisado" en los filtros existentes

### 4. `src/components/NotificationSection.tsx`
- Agregar checkbox de "Revisado" en cada fila de correo enviado (junto al estado actual)
- Al cambiar, llamar `toggleReviewed` que invalida todas las query keys para sincronizar con historial

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Migración BD | Agregar `reviewed` y `reviewed_at` a `notification_emails` |
| `src/hooks/useNotificationEmails.tsx` | Interface + mutación `toggleReviewed` |
| `src/components/EmailHistoryView.tsx` | Columna "Revisado" con checkbox en ambas pestañas |
| `src/components/NotificationSection.tsx` | Checkbox "Revisado" en cada correo de la tarjeta del tema |

