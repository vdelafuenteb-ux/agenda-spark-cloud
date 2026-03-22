

## Plan: Agregar `closed_at` a topics + KPI de cumplimiento de cierre en Dashboard

### 1. Migración: Agregar columna `closed_at` a `topics`
- Nueva columna `closed_at` (timestamptz, nullable, default null)
- Backfill: para temas ya completados, setear `closed_at = updated_at`

### 2. Auto-setear `closed_at` al cerrar un tema (`src/pages/Index.tsx`)
- En el handler `onUpdate`, cuando `status === 'completado'`, incluir `closed_at: new Date().toISOString()` en el update
- Cuando se reabre un tema, limpiar `closed_at: null`

### 3. Botones "Cerrar" en `TopicCard.tsx` (líneas ~531 y ~576)
- Agregar `closed_at: new Date().toISOString()` a los onClick de los botones "Cerrar"
- En el botón "Reabrir", agregar `closed_at: null`

### 4. Mostrar info de cierre en la tarjeta (`TopicCard.tsx`)
- Cambiar la línea que muestra "Cerrado {fecha}" (línea ~203) para usar `closed_at` en vez de `updated_at`
- Agregar un badge indicando si cerró "A tiempo", "Anticipado" o "Con atraso (X días)" comparando `closed_at` vs `due_date`

### 5. KPI de cumplimiento en Dashboard (`DashboardView.tsx`)
Nuevo KPI card + sección de análisis de cierre:
- De los temas completados que tienen `due_date` y `closed_at`:
  - **A tiempo o antes**: `closed_at <= due_date`
  - **Con atraso**: `closed_at > due_date`
- KPI card: "Cumplimiento de Cierre" con porcentaje de temas cerrados a tiempo
- Detalle debajo de los KPI existentes: card con barrita de progreso y desglose (X a tiempo, Y con atraso, promedio de días de atraso)

### Archivos a modificar
1. **Migración SQL** — agregar `closed_at` + backfill
2. **`src/pages/Index.tsx`** — setear/limpiar `closed_at` en onUpdate
3. **`src/components/TopicCard.tsx`** — botones Cerrar/Reabrir + display de badge de cumplimiento
4. **`src/components/DashboardView.tsx`** — nuevo KPI de cumplimiento de cierre

