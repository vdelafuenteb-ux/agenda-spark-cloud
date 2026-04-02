

## Plan: Correo semanal de recordatorio de reportes

### Qué se construirá

Un nuevo tipo de correo automático configurable: un recordatorio simple con un mensaje personalizado (ej: "Estimados por favor no olvidar enviar los reportes semanales") que se envía a correos seleccionados en un día y hora específicos. Se gestiona desde la sección de Correos Automáticos en Configuración.

### Cambios

**1. Nueva tabla `reminder_emails` (migración)**

Almacena las configuraciones de correos recordatorio simples:
- `id`, `user_id`, `enabled`, `day_of_week`, `send_hour`, `message` (texto del correo), `recipient_emails` (jsonb array de strings), `created_at`, `updated_at`

RLS: solo el usuario dueño puede CRUD.

**2. Hook `useReminderEmails.tsx`**

CRUD para la tabla `reminder_emails`, mismo patrón que `useEmailSchedules`.

**3. Componente `ReminderEmailSettings.tsx`**

Formulario con:
- Switch activar/desactivar
- Selector de día y hora
- Textarea para el mensaje a enviar
- Lista de correos destinatarios (input para agregar/quitar emails)
- Resumen de la configuración
- Botones guardar/eliminar

**4. Integrar en `SettingsView.tsx`**

Renderizar `ReminderEmailSettings` debajo de `EmailScheduleSettings` en la sección "Correos Automáticos".

**5. Edge function `send-reminder-email/index.ts`**

- Consulta `reminder_emails` donde `enabled = true`, `day_of_week` coincide con el día actual y `send_hour` con la hora actual (Chile)
- Envía el mensaje a cada email en `recipient_emails` vía la API de Firebase existente
- Se invoca por cron (mismo patrón que `send-scheduled-emails`)

**6. Cron job**

Agregar un cron que invoque `send-reminder-email` cada hora (mismo patrón existente).

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Migración BD | Crear tabla `reminder_emails` con RLS |
| `src/hooks/useReminderEmails.tsx` | Nuevo hook CRUD |
| `src/components/ReminderEmailSettings.tsx` | Nuevo componente UI |
| `src/components/SettingsView.tsx` | Agregar `ReminderEmailSettings` en sección correos automáticos |
| `supabase/functions/send-reminder-email/index.ts` | Nueva edge function |
| `supabase/config.toml` | Agregar `verify_jwt = false` para la función |
| SQL (insert tool) | Crear cron job |

