

## Plan: Mostrar departamento en ficha de persona + corregir conteo y scores por departamento

### Problemas

1. **Ficha del responsable** no muestra a qué departamento está asignado
2. **Tarjetas de departamento** en TeamView derivan las personas desde los topics (`topics.department_id`), no desde la asignación real en configuración (`assignees.department_id`). Esto causa conteos incorrectos de personas
3. **Scores por departamento** deben ser el promedio de scores de las personas asignadas al departamento vía `assignees.department_id`, no de quienes tienen topics en ese departamento

### Cambios

**1. `src/components/AssigneeProfileView.tsx` — Mostrar departamento**
- Importar `useDepartments`
- En el header (línea 341-344), debajo del email, mostrar el nombre del departamento si `assignee?.department_id` coincide con algún departamento, o "Sin departamento" si no tiene asignado

**2. `src/components/TeamView.tsx` — Corregir `deptMetrics`**
- Cambiar la lógica para derivar personas desde `assignees.department_id === dept.id` en vez de extraerlas de los topics
- El conteo de personas será exactamente las que están configuradas en ese departamento
- El score será el promedio de productivity scores de esas personas asignadas
- Los temas activos y cerrados se mantienen contando por `topics.department_id`
- Si un departamento no tiene personas asignadas, mostrar "Sin personas" y no mostrar score

**3. `src/components/DashboardView.tsx` — Misma corrección en `deptScores`**
- Aplicar la misma lógica: derivar assignees desde `assignees.department_id` para calcular el score promedio por departamento

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Agregar departamento en header de la ficha |
| `src/components/TeamView.tsx` | Corregir `deptMetrics` para usar `assignees.department_id` |
| `src/components/DashboardView.tsx` | Corregir `deptScores` para usar `assignees.department_id` |

