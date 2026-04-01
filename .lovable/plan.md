

## Plan: Recordatorios por tema — "Recuérdame revisar esto"

### Qué se construirá

Un sistema de recordatorios por tema donde puedes programar fechas específicas para recibir un correo a tu email (matias@transitglobalgroup.com) recordándote revisar un tema. Podrás agregar múltiples recordatorios por tema, editarlos y eliminarlos.

### Cambios

**1. Nueva tabla `topic_reminders` (migración)**
- `id`, `user_id`, `topic_id`, `reminder_date` (date), `note` (texto opcional, ej: "Revisar avance polígonos"), `sent` (boolean, default false), `created_at`
- RLS: solo el dueño puede CRUD

**2. Hook `useTopicReminders.tsx`**
- CRUD para recordatorios: crear, editar fecha/nota, eliminar, marcar como enviado
- Query por `topic_id`

**3. Componente `TopicReminders.tsx`**
- Sección dentro del TopicCard (después de NotificationSection), con ícono de campana
- Lista de recordatorios programados con fecha y nota
- Botón para agregar nuevo: abre popover con date picker + campo de nota
- Cada recordatorio permite editar fecha/nota o eliminar
- Badge visual: "Pendiente" (naranja) o "Enviado" (verde)

**4. Edge function `send-topic-reminders/index.ts`**
- Se ejecuta vía cron diario
- Consulta `topic_reminders` donde `reminder_date = hoy` y `sent = false`
- Para cada uno, obtiene el tema y envía correo al usuario (usando el email del auth user o hardcoded matias@transitglobalgroup.com) vía Firebase Cloud Function existente
- Marca como `sent = true`

**5. Cron job para ejecutar la función diariamente**
- `pg_cron` + `pg_net` para invocar la edge function cada día a las 8:00 AM Chile

**6. Integración en TopicCard.tsx**
- Agregar `TopicReminders` debajo de `NotificationSection`, visible para temas activos y en seguimiento

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Migración BD | Crear tabla `topic_reminders` con RLS |
| `src/hooks/useTopicReminders.tsx` | Nuevo hook CRUD |
| `src/components/TopicReminders.tsx` | Nuevo componente UI |
| `src/components/TopicCard.tsx` | Integrar TopicReminders |
| `supabase/functions/send-topic-reminders/index.ts` | Nueva edge function |
| Cron job (insert SQL) | Programar ejecución diaria |

