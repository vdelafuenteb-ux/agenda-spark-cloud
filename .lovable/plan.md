

## Plan: Permitir cerrar temas desde ReviewView con diálogo de confirmación

### Problema
En `ReviewView.tsx`, los items de tipo `'topic'` tienen `onToggle: () => {}` (vacío) y el botón está `disabled={item.type === 'topic'}`. No se puede cerrar un tema desde la vista de Revisión.

### Solución

**En `src/components/ReviewView.tsx`:**

1. **Agregar prop `onUpdateTopic`** para recibir la función de actualización de temas (ya existe en `Index.tsx`).

2. **Agregar estado para diálogo de cierre**: `showCloseDialog`, `closeTopicId`, `closeDateDraft` — idéntico al de `TopicCard.tsx`.

3. **Conectar el toggle de topics**: En vez de `onToggle: () => {}`, asignar una función que abra el diálogo de confirmación con el `topic.id`.

4. **Quitar `disabled={item.type === 'topic'}`** del botón para permitir click.

5. **Agregar el Dialog de confirmación** (mismo diseño que TopicCard): input `datetime-local`, botones Cancelar/Confirmar. Al confirmar, llama `onUpdateTopic(id, { status: 'completado', closed_at, pause_reason: '', paused_at: null })`.

**En `src/pages/Index.tsx`:**

6. **Pasar `onUpdateTopic`** como prop a `ReviewView`, usando la función `handleUpdateTopic` existente.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/ReviewView.tsx` | Agregar prop `onUpdateTopic`, estado del diálogo, lógica de cierre con confirmación fecha/hora, quitar disabled en topics |
| `src/pages/Index.tsx` | Pasar `onUpdateTopic` a `ReviewView` |

