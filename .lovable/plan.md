

## Plan: KPIs de impacto de reprogramaciones (sobretiempo y frecuencia)

### Problema
No hay visibilidad del impacto real de las reprogramaciones: cuánto tiempo extra tomó un tema vs lo planificado originalmente, ni el promedio de veces que se reprograma una tarea.

### Solución
Calcular métricas de sobretiempo usando `start_date`, la primera `due_date` registrada (date original antes de reprogramaciones) vs la fecha final (`due_date` actual o `closed_at`), y mostrar esto en 3 lugares.

### Lógica de cálculo

Para cada tema con reprogramaciones:
- **Duración planificada original**: `start_date` → primera `due_date` (si hay reschedules, tomar `previous_date` del primer reschedule como la fecha original)
- **Duración real**: `start_date` → `closed_at` (o `due_date` actual si no está cerrado)
- **Sobretiempo**: `duración_real - duración_planificada` en días/semanas
- **% sobretiempo**: `(duración_real / duración_planificada - 1) * 100`

Promedios globales:
- **Promedio de reprogramaciones por tema** (solo temas que tienen al menos 1)
- **Promedio de días de sobretiempo** por reprogramación
- **% promedio de sobretiempo** sobre duración planificada

### Cambios en UI

**1. TopicCard (tarjeta expandida)**
- Junto al historial de reprogramaciones, agregar un mini resumen: "Planificado: 2 sem → Real: 5 sem (+150% sobretiempo)"

**2. Dashboard — Enriquecer card de Reprogramaciones**
- Agregar fila de KPIs:
  - Promedio de reprogramaciones por tema: `2.3x`
  - Tiempo promedio de extensión: `+8 días`
  - % promedio de sobretiempo: `+45%`
- Esto indica "estoy programando mal" con datos concretos

**3. AssigneeProfileView — Pestaña Temas**
- Agregar stats de reprogramación del trabajador: promedio de reprogs, sobretiempo promedio
- En la tabla de temas, la columna 🔄 ya muestra el conteo; agregar tooltip con "Original: X sem → Real: Y sem"

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/DashboardView.tsx` | Enriquecer card de Reprogramaciones con KPIs de sobretiempo y frecuencia promedio |
| `src/components/AssigneeProfileView.tsx` | Agregar stats de sobretiempo en pestaña Temas |
| `src/components/TopicCard.tsx` | Mini resumen de sobretiempo en historial de reprogramaciones |

