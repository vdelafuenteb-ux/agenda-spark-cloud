

## Plan: Corregir tendencia — indicador y gráfico inconsistentes

### Problema

- El indicador `▲ +5` compara el score en vivo vs el **penúltimo** snapshot (`scoreSnapshots[length - 2]`), pero debería comparar vs el **último** snapshot (`scoreSnapshots[length - 1]`)
- El gráfico de tendencia solo muestra snapshots históricos y **no incluye el score actual** como último punto, por eso la línea "baja" mientras el indicador dice que subió

### Corrección en `src/components/AssigneeProfileView.tsx`

**1. Indicador de tendencia (línea ~468)**
- Cambiar `scoreSnapshots[scoreSnapshots.length - 2]` → `scoreSnapshots[scoreSnapshots.length - 1]`
- El último snapshot es el punto de comparación correcto (el score en vivo es el valor actual)

**2. Gráfico de tendencia (línea ~536)**
- Agregar el score en vivo como último punto del `LineChart data`:
```
const chartData = [
  ...scoreSnapshots,
  { label: 'Hoy', score: metrics.productivityScore }
];
```
- Así el gráfico refleja la trayectoria real hasta el momento actual

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Fix comparación de tendencia + agregar score actual al gráfico |

