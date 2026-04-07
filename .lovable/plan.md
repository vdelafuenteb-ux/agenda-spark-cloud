

## Plan: Corregir tokens de correos programados semanales

### Problema confirmado

En `send-scheduled-emails/index.ts` líneas 112-119, la búsqueda de tokens reutilizables:
1. No filtra por `used = false` — puede reutilizar un token ya usado
2. No filtra por `topic_id IS NULL` — puede reutilizar un token creado para un recordatorio individual (que tiene `topic_id` seteado)

Cuando el responsable abre el link con ese token, `validate-update-token` detecta que `topic_id` existe y filtra solo ese tema, mostrando 1 en vez de 5.

### Solución

**Archivo: `supabase/functions/send-scheduled-emails/index.ts`**

Cambiar la query de búsqueda de tokens existentes (líneas 112-119) para agregar dos filtros:

```typescript
const { data: existingToken } = await supabase
  .from("update_tokens")
  .select("token, expires_at")
  .eq("user_id", schedule.user_id)
  .eq("assignee_name", assignee.name)
  .eq("used", false)          // solo tokens no usados
  .is("topic_id", null)       // solo tokens genéricos (sin topic_id)
  .gt("expires_at", new Date().toISOString())
  .limit(1)
  .single();
```

Esto asegura que los correos semanales siempre usen un token genérico que muestre todos los temas del responsable.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/send-scheduled-emails/index.ts` | Agregar filtros `.eq("used", false)` y `.is("topic_id", null)` en búsqueda de tokens |

