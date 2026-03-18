

## Plan: Resaltar subtareas del día en la vista de Revisión

### Problema
Cuando un tema aparece en "Mi día" porque tiene una subtarea para hoy (pero el tema tiene otra fecha de cierre), no se distingue visualmente por qué está ahí. El usuario necesita ver rápidamente cuál subtarea es la que vence hoy.

### Solución

Agregar una prop `highlightToday` al `TopicCard` que, cuando es `true`:

1. **En el header del tema**: Muestra un mini-badge "📌 Subtarea hoy" junto al título para indicar que el tema aparece por una subtarea, no por su fecha de cierre.
2. **En las subtareas**: Las subtareas con `due_date` de hoy se resaltan con un fondo amarillo/azul claro y un badge "Hoy" al lado de su fecha, haciéndolas visualmente distintas.
3. **Auto-expandir**: Cuando `highlightToday` es true, el TopicCard se abre expandido automáticamente para que las subtareas sean visibles de inmediato.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/TopicCard.tsx` | Agregar prop `highlightToday?: boolean`. Resaltar subtareas con `due_date` de hoy (fondo + badge). Mostrar indicador en header si el tema no vence hoy pero tiene subtarea hoy. Auto-expandir si `highlightToday`. |
| `src/components/ReviewView.tsx` | Pasar `highlightToday={true}` al TopicCard cuando estamos en la tab "hoy" y el tema aparece solo por subtareas (no por su propia `due_date`). |

