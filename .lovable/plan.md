

## Plan: Limpiar y ordenar la visualización de subtareas

### Problema
Cada subtarea muestra dos fechas (fecha de creación inline y fecha de vencimiento a la derecha) sin etiquetas, lo que confunde al usuario.

### Solución

Simplificar la fila de subtarea para que sea limpia y profesional:

1. **Eliminar la fecha de creación** del texto inline (línea 274-276) — no aporta valor visible
2. **Mantener solo la fecha de vencimiento** a la derecha, con un icono de calendario y formato claro
3. **Reorganizar la fila** con un layout más ordenado:
   - `[checkbox] [título] [badge Hoy si aplica]` ← izquierda
   - `[fecha vencimiento con icono] [botón eliminar]` ← derecha, alineado

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/TopicCard.tsx` | Líneas 269-277: eliminar el `<span>` con `created_at`, dejar solo título + badge Hoy. Líneas 278-289: agregar icono de calendario junto a la fecha de vencimiento para que se vea consistente y claro. |

