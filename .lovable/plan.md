

## Diagnóstico: Tema reactivado de Vicente Godoy desaparecido

### Hipótesis
El usuario cambió un tema de "pausado" → "activo", pero ya no aparece en la lista. Las causas más probables:

1. **El tema quedó archivado** (`archived = true`). La pestaña "En curso" oculta los archivados — habría que revisar la pestaña "Archivados".
2. **Filtro activo** (departamento, responsable, etiqueta, búsqueda) que lo está excluyendo.
3. **Pestaña de estado equivocada** — quizá quedó en "seguimiento" en vez de "activo".
4. **Caché de React Query desactualizada** — la mutación optimista no invalidó correctamente.

### Verificación (necesito leer la BD para confirmar)

Voy a consultar Supabase para encontrar los temas de Vicente Godoy modificados recientemente y revisar su `status`, `archived`, `paused_at` y `updated_at`. Con eso confirmamos cuál es el tema y dónde está realmente.

### Plan de acción

1. **Diagnóstico (read-only ahora)**: ejecutar query a `topics` filtrando por `assignee = 'Vicente Godoy'` ordenado por `updated_at DESC` para identificar el tema afectado y su estado actual.
2. **Según el resultado**:
   - Si `archived = true` → revisar `TopicCard.tsx` para asegurar que al cambiar de "pausado" a "activo" se desarchive automáticamente (o al menos avisar al usuario). Posible fix: en el handler de cambio de estado, si pasa de pausado a activo y está archivado, setear `archived = false`.
   - Si `status` quedó incorrecto (ej. `seguimiento`) → revisar el flujo de "reactivar" en el diálogo de pausa.
   - Si está correcto en BD pero no aparece en UI → revisar invalidación de cache en `useTopics.updateTopic` y los filtros activos en `Index.tsx`.
3. **Comunicar al usuario** dónde está el tema y aplicar el fix correspondiente.

### Archivos a revisar/modificar (probable)

| Archivo | Cambio probable |
|---|---|
| `src/components/TopicCard.tsx` | Al reactivar (pausado → activo), desarchivar automáticamente y limpiar `pause_reason`/`paused_at` |
| `src/hooks/useTopics.tsx` | Verificar que `updateTopic` invalide correctamente |

