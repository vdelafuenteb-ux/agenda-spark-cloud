

## Plan: Corregir "Score por Departamento" en Dashboard — usar department_id de topics, no de assignees

### Problema
En `DashboardView.tsx`, `deptScores` filtra assignees por `a.department_id === dept.id`, pero **todos los assignees tienen `department_id = null`** en la BD. Los departamentos están asignados a los **topics**, no a los assignees. Por eso muestra "Sin datos de departamentos".

La vista de **Equipo (TeamView)** funciona porque usa `topics.department_id`, no `assignees.department_id`.

### Solución

**En `src/components/DashboardView.tsx`** (líneas 80-91), cambiar la lógica de `deptScores` para:

1. Obtener los responsables de cada departamento a través de los **topics** (misma lógica que TeamView):
   - Filtrar topics por `t.department_id === dept.id`
   - Extraer los nombres de assignees únicos de esos topics
   - Buscar sus scores en `liveScores`

```typescript
const deptScores = useMemo(() => {
  return departments.map(dept => {
    const deptTopics = topics.filter(t => t.department_id === dept.id);
    const uniqueAssignees = [...new Set(deptTopics.map(t => t.assignee).filter(Boolean))];
    const scores = uniqueAssignees
      .map(name => liveScores.get(name!))
      .filter((s): s is number => s !== undefined);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { name: dept.name, avg, count: uniqueAssignees.length };
  })
  .filter(d => d.count > 0)
  .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
}, [departments, topics, liveScores]);
```

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/DashboardView.tsx` | Cambiar `deptScores` para derivar assignees desde topics por department_id en vez de assignees.department_id |

