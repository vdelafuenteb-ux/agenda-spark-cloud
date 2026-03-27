

## Plan: Sistema de Registro de Reprogramaciones de Temas

### Problema
Cuando se cambia la fecha de vencimiento de un tema, no queda registro. No se sabe cuántas veces se reprogramó ni por qué. Esto es crítico para una PMO efectiva.

### Solución

**Nueva tabla `topic_reschedules`** que registra cada cambio de fecha con motivo:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Dueño |
| `topic_id` | uuid | Tema reprogramado |
| `previous_date` | date | Fecha anterior |
| `new_date` | date | Fecha nueva |
| `reason` | text | Motivo de la reprogramación |
| `is_external` | boolean | Si fue por causa externa (fuera de control) o interna |
| `created_at` | timestamptz | Cuándo se hizo el cambio |

RLS: solo el `user_id` autenticado accede a sus registros.

### Cambios en UI

**1. TopicCard — Dialog al cambiar fecha**
- Al seleccionar una nueva fecha de vencimiento (en ambos calendarios del TopicCard), en vez de hacer `onUpdate` directo, abrir un Dialog que pida:
  - Motivo de la reprogramación (texto)
  - Checkbox: "Causa externa" (fuera de nuestro control)
- Al confirmar, guardar en `topic_reschedules` y luego actualizar la fecha
- Mostrar un badge con contador de reprogramaciones junto a la fecha (ej: "🔄 3")

**2. TopicCard — Historial expandido**
- En la sección expandida, mostrar lista de reprogramaciones con fecha anterior → nueva, motivo, y si fue externa

**3. Dashboard — KPI de reprogramaciones**
- Nuevo KPI: "Temas reprogramados" con cantidad y desglose interno/externo
- Tabla de temas más reprogramados

**4. AssigneeProfileView — Stats por trabajador**
- Mostrar cantidad de reprogramaciones por trabajador
- Distinguir internas vs externas para evaluar responsabilidad

### Hook `useReschedules`
- Query por `topic_id` o general
- Mutation `createReschedule` que inserta el registro

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Nueva migración | Crear tabla `topic_reschedules` con RLS |
| `src/hooks/useReschedules.tsx` | Nuevo hook CRUD |
| `src/components/TopicCard.tsx` | Dialog de motivo al cambiar fecha + badge contador + historial |
| `src/components/DashboardView.tsx` | KPI de reprogramaciones |
| `src/components/AssigneeProfileView.tsx` | Stats de reprogramaciones por trabajador |
| `src/hooks/useTopics.tsx` | Cargar reschedules junto con topics |

