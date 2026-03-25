

## Plan: Diálogo de confirmación al cerrar tema con fecha/hora editable

### Problema
Al cerrar un tema, se guarda `closed_at = now()` automáticamente. Si el responsable respondió ayer y el usuario revisa hoy, el cierre queda con fecha incorrecta, afectando los KPIs de cumplimiento.

### Solución
Agregar un diálogo de confirmación (igual al de pausar) que muestre la fecha/hora actual y permita editarla antes de confirmar el cierre.

### Cambios en `src/components/TopicCard.tsx`

1. **Nuevo estado**: `showCloseDialog` (boolean) y `closeDateDraft` (string, formato `datetime-local`)
2. **Botones "Cerrar"** (líneas ~642 y ~687): En vez de llamar `onUpdate` directamente, abrir el diálogo con `closeDateDraft` inicializado a `now()`
3. **Nuevo Dialog** (junto al de pausa):
   - Título: "¿Confirmar cierre de este tema?"
   - Mensaje: "Confirma la fecha y hora en que se cerró realmente este tema"
   - Input `datetime-local` con el valor editable
   - Botones: Cancelar / Confirmar cierre
   - Al confirmar: `onUpdate(topic.id, { status: 'completado', closed_at: isoFromLocal, pause_reason: '', paused_at: null })`

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/TopicCard.tsx` | Agregar diálogo de confirmación con datetime editable para cerrar temas |

