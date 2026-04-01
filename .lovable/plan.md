

## Plan: Correo de felicitaciones al cerrar un tema

### Qué se construirá

Cuando confirmes el cierre de un tema, el sistema enviará automáticamente un correo al responsable (assignee) felicitándolo por completar el tema. El correo incluirá:
- Nombre del tema
- Si se cerró a tiempo o con retraso
- El último mensaje de la bitácora
- CC a gerencia como en los demás correos

### Cambios

**1. Nueva edge function `send-topic-closed-notification`**

Edge function que recibe: `to_email`, `to_name`, `topic_title`, `due_date`, `closed_at`, `is_ongoing`, `last_progress_entry`. Construye un HTML con:
- "¡Felicitaciones! Se ha cerrado el tema: [título]"
- Badge verde "✅ A tiempo" o rojo "⚠️ Fuera de plazo" (temas continuos siempre "A tiempo")
- Último avance de la bitácora
- CC a matias@ y vicente@

**2. Invocar la función al confirmar cierre en `TopicCard.tsx`**

En el botón "Confirmar cierre" (~línea 1069-1081), después de llamar `onUpdate(...)`:
- Verificar que el tema tenga `assignee` con email
- Buscar el email del assignee en la lista de `assignees`
- Invocar `supabase.functions.invoke('send-topic-closed-notification', { body: ... })`
- Toast de confirmación/error

**3. Mismo cambio en `ReviewView.tsx`**

En el diálogo de cierre (~línea 364-368), agregar la misma lógica de envío de correo.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/send-topic-closed-notification/index.ts` | Nueva edge function |
| `src/components/TopicCard.tsx` | Invocar correo al confirmar cierre |
| `src/components/ReviewView.tsx` | Invocar correo al confirmar cierre desde revisión |

