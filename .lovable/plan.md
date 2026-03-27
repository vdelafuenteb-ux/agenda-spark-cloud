

## Plan: Dividir tarjeta de Cumplimiento de Cierre + agregar Score por Departamento

### Cambio

En `src/components/DashboardView.tsx`, la tarjeta "Cumplimiento de Cierre" (líneas 393-446) actualmente usa un grid de 4 columnas. Se va a:

1. **Eliminar la 4ta columna** (el gráfico de barra verde/rojo de la derecha, líneas 433-442)
2. **Convertir la tarjeta en 2 mitades** usando un grid de 2 columnas (`grid-cols-2`):
   - **Mitad izquierda**: Cumplimiento de Cierre actual (tasa %, a tiempo, con atraso) en un sub-grid de 3 columnas
   - **Mitad derecha**: "Score por Departamento" — lista de departamentos con su puntaje promedio de productividad, ordenados de mayor a menor

3. **Calcular score por departamento**: Usando `liveScores` (ya disponible) y `assignees` + `departments`, agrupar responsables por departamento, promediar sus scores, y mostrar:
   - Nombre del departamento
   - Score promedio (con color verde/amarillo/rojo)
   - Cantidad de integrantes
   - Barra de progreso pequeña

### Lógica del score por departamento

```typescript
const deptScores = useMemo(() => {
  return departments.map(dept => {
    const deptAssignees = assignees.filter(a => a.department === dept.name);
    const scores = deptAssignees
      .map(a => liveScores.get(a.name))
      .filter((s): s is number => s !== undefined);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { name: dept.name, avg, count: deptAssignees.length, withScore: scores.length };
  })
  .filter(d => d.count > 0)
  .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
}, [departments, assignees, liveScores]);
```

### Layout visual

```text
┌──────────────────────────────────────────────────────────┐
│  Cumplimiento de Cierre          │  Score por Departamento│
│                                  │                        │
│  73%   ● 8 A tiempo  ● 3 Atraso │  1. Depto A  — 85 pts │
│  Tasa  Prom 3d antes  Prom 2d   │  2. Depto B  — 72 pts │
│  ████████░░            atraso    │  3. Depto C  — 61 pts │
└──────────────────────────────────────────────────────────┘
```

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/DashboardView.tsx` | Calcular `deptScores`, eliminar barra gráfica, dividir tarjeta en 2 mitades con score por departamento |

