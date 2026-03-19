

## Plan: Bitácora de avances para subtareas

Actualmente cada subtarea tiene un campo `notes` (texto plano) que se muestra como un textarea simple. El usuario quiere reemplazarlo con una bitácora de avances ordenada cronológicamente, igual que la que ya tienen los temas.

### Cambios

**1. Nueva tabla `subtask_entries` (migración)**
- Columnas: `id`, `subtask_id` (FK a subtasks), `content`, `created_at`
- RLS: solo usuarios autenticados, filtrado por ownership vía join a subtasks → topics → user_id
- Habilitar realtime no es necesario

**2. Hook `useTopics.tsx` — cargar y gestionar entradas de subtareas**
- Agregar query de `subtask_entries` en el `Promise.all` existente
- Construir mapa `entriesBySubtask` y adjuntar a cada subtask como `subtask_entries[]`
- Agregar mutaciones: `addSubtaskEntry`, `updateSubtaskEntry`, `deleteSubtaskEntry`

**3. `SubtaskRow.tsx` — reemplazar textarea por ProgressLog**
- Eliminar el textarea de notas y el estado/debounce asociado
- Al hacer clic en el icono de comentarios, mostrar un mini `ProgressLog` (el mismo componente reutilizado) con las entradas de la subtarea
- Pasar callbacks `onAddEntry`, `onUpdateEntry`, `onDeleteEntry` desde props

**4. `TopicCard.tsx` — pasar las nuevas props**
- Pasar los callbacks de subtask entries desde el hook hacia cada `SubtaskRow`

### Resultado visual
- El icono de comentario abre una bitácora limpia con entradas con fecha, editable/borrable, con input para agregar — idéntica a la bitácora del tema pero compacta, indentada debajo de la subtarea.

