

## Plan: Hora de respuesta editable + estadística de cumplimiento en ficha del responsable

### Resumen

Tres cambios principales:
1. Al confirmar un correo, permitir editar la hora/fecha de respuesta (no solo usar `now()`).
2. Determinar si la respuesta fue "a tiempo" (dentro de 48h) o "fuera de plazo" comparando `confirmed_at` vs `sent_at + 48h`.
3. Agregar una estadística de cumplimiento de respuesta de correos en la ficha personal de cada responsable.

---

### 1. Hora de confirmación editable

**EmailHistoryView.tsx** y **NotificationSection.tsx**: Al hacer clic en el checkbox de confirmación, en lugar de guardar `new Date().toISOString()` directamente, mostrar un pequeño popover/input de fecha-hora para que el admin pueda ajustar cuándo realmente respondió la persona. Por defecto se pre-llena con la hora actual pero es editable.

- Agregar un componente inline (popover con input `datetime-local`) que aparece al confirmar.
- Al guardar, envía el `confirmed_at` editado al update de Supabase.
- Si se desmarca, se limpia `confirmed_at` como antes.

**useNotificationEmails.tsx**: Modificar `toggleConfirmed` para aceptar un `confirmed_at` opcional en lugar de siempre usar `now()`.

### 2. Indicador "a tiempo" vs "fuera de plazo" en confirmados

**EmailHistoryView.tsx**: En la columna "Plazo 48h", cuando el correo está confirmado, en vez de solo mostrar "Respondido", mostrar:
- **"A tiempo"** (verde) si `confirmed_at <= sent_at + 48h`
- **"Fuera de plazo"** (rojo) si `confirmed_at > sent_at + 48h`

Actualizar `getDeadlineInfo()` para recibir `confirmed_at` y calcular si fue dentro del plazo.

### 3. Estadística de cumplimiento de correos en ficha del responsable

**AssigneeProfileView.tsx**: Agregar una tarjeta/sección compacta (similar a "Cumplimiento de cierre" del dashboard) que muestre:
- Total de correos confirmados
- Respondidos a tiempo vs fuera de plazo
- Porcentaje de cumplimiento

Esto se calcula comparando `confirmed_at` vs `sent_at + 48h` para cada correo confirmado del responsable.

---

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/EmailHistoryView.tsx` | Popover para editar `confirmed_at`, actualizar `getDeadlineInfo` para mostrar a tiempo/fuera de plazo |
| `src/hooks/useNotificationEmails.tsx` | `toggleConfirmed` acepta `confirmed_at` personalizado |
| `src/components/AssigneeProfileView.tsx` | Agregar KPI de cumplimiento de respuesta de correos con desglose a tiempo/fuera de plazo |
| `src/components/NotificationSection.tsx` | Actualizar el toggle de confirmación para permitir editar hora |

### Notas técnicas
- No se requieren cambios de base de datos: `confirmed_at` (timestamptz) ya existe.
- El cálculo es: `new Date(confirmed_at) <= new Date(sent_at).getTime() + 48*60*60*1000` → a tiempo.

