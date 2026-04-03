

## Plan: Mejorar selección de destinatarios y diseño del correo recordatorio

### Cambios

**1. Componente `ReminderEmailSettings.tsx`**

- Recibir `assignees` como prop (desde SettingsView que ya los tiene)
- Reemplazar el input manual de correo por una lista de checkboxes con los responsables que tienen email registrado (nombre + email)
- Mantener opción de agregar correos adicionales manualmente (por si quieres enviar a alguien que no es responsable)
- Al marcar/desmarcar un responsable, se agrega/quita su email de `recipient_emails`
- Agregar campo configurable para el **asunto** del correo (actualmente fijo "📋 Recordatorio semanal")

**2. Base de datos: agregar columna `subject`**

- Migración para agregar `subject TEXT DEFAULT 'Recordatorio semanal'` a la tabla `reminder_emails`
- Actualizar hook `useReminderEmails` para incluir el campo

**3. Componente `SettingsView.tsx`**

- Pasar `assignees` como prop a `ReminderEmailSettings`

**4. Edge function `send-reminder-email/index.ts`**

- Usar el campo `subject` de la BD como asunto (en vez del fijo)
- Mejorar el HTML del correo con diseño profesional: header con gradiente, tipografía ejecutiva, separadores, footer corporativo — mismo estilo que los correos de cierre de tema

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Migración BD | Agregar columna `subject` a `reminder_emails` |
| `src/hooks/useReminderEmails.tsx` | Agregar campo `subject` al tipo y mutations |
| `src/components/ReminderEmailSettings.tsx` | Recibir assignees, checkboxes de selección, campo asunto |
| `src/components/SettingsView.tsx` | Pasar `assignees` a `ReminderEmailSettings` |
| `supabase/functions/send-reminder-email/index.ts` | Usar subject dinámico, HTML profesional |

