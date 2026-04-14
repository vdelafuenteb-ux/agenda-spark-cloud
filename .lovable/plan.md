

## Plan: Descripción fijada + historial completo en página de actualización

### Resumen

Dos mejoras en la página externa `/update/:token` que ven los responsables:

1. **Primer mensaje de bitácora fijado como "Descripción"** — siempre visible arriba del tema (incluso colapsado), separado visualmente del resto del historial.
2. **Historial completo visible** — actualmente solo muestra los últimos 3 mensajes; se mostrará todo el historial con scroll.

### Cambios

#### 1. Edge Function `validate-update-token/index.ts`

- Quitar el `limit(50)` y el `.slice(0, 5)` para devolver **todas** las entradas de progreso por tema.
- Ordenar por `created_at ascending` para identificar fácilmente el primer mensaje.
- Separar en la respuesta JSON: `description` (primer entry sin source "assignee") y `all_entries` (el resto).

#### 2. Página `src/pages/UpdateTopics.tsx`

- Actualizar la interfaz `TopicData` para incluir `description: { content: string; created_at: string } | null` además de `recent_entries` (ahora con todos los mensajes).
- **Descripción fijada**: Mostrar siempre debajo del header del tema (visible incluso colapsado), con estilo diferenciado — fondo azul suave, icono de pin, etiqueta "DESCRIPCIÓN".
- **Historial completo**: Reemplazar el `.slice(0, 3)` actual por la lista completa con un contenedor scrollable (max-height ~300px). Mantener los estilos azul/gris según source.

#### 3. Correos semanales `send-scheduled-emails/index.ts`

- Incluir el primer mensaje de bitácora como sección "Descripción" en el HTML del correo semanal, antes de las subtareas pendientes.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/validate-update-token/index.ts` | Devolver todas las entries, separar `description` del resto |
| `src/pages/UpdateTopics.tsx` | Mostrar descripción fijada + historial completo con scroll |
| `supabase/functions/send-scheduled-emails/index.ts` | Incluir descripción en el HTML del correo |

