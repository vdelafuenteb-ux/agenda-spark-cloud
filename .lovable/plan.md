

## Plan: Separar correos informativos de correos de seguimiento semanal

### Problema
Los correos de notificación de "tema nuevo agregado" se mezclan con los correos masivos del lunes en el historial, apareciendo con estado "Pendiente" y plazo de 48h, cuando en realidad son informativos y no requieren confirmación.

### Solución

**1. Migración de base de datos** — Agregar columna `email_type` a `notification_emails`:
```sql
ALTER TABLE notification_emails 
  ADD COLUMN email_type text NOT NULL DEFAULT 'weekly';
```
- `'weekly'` = correos masivos del lunes (con plazo 48h y confirmación)
- `'new_topic'` = notificación informativa de tema nuevo (sin plazo)

**2. Marcar correos de tema nuevo** — En `src/pages/Index.tsx`, al insertar en `notification_emails` después de crear un tema, agregar `email_type: 'new_topic'`.

**3. Sub-pestañas en EmailHistoryView** — Agregar dos tabs dentro del historial:
- **"Seguimiento semanal"** (default): Muestra solo `email_type = 'weekly'`. Mantiene toda la lógica actual (48h, confirmación, estadísticas).
- **"Temas adicionales"**: Muestra solo `email_type = 'new_topic'`. Sin plazo de 48h, sin checkbox de confirmación, solo muestra que se envió la notificación (fecha, persona, tema).

**4. NotificationSection** — El correo automático de tema nuevo que aparece en la sección del tema individual también se mostrará sin el plazo de 48h ni opción de confirmar cuando sea tipo `new_topic`.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| Migración SQL | Agregar columna `email_type` con default `'weekly'` |
| `src/pages/Index.tsx` | Insertar con `email_type: 'new_topic'` |
| `src/components/EmailHistoryView.tsx` | Agregar tabs "Seguimiento semanal" / "Temas adicionales", filtrar por tipo, ocultar plazo en la pestaña informativa |
| `src/hooks/useNotificationEmails.tsx` | Agregar `email_type` a la interfaz |
| `src/components/NotificationSection.tsx` | Ocultar plazo/confirmación para correos tipo `new_topic` |

