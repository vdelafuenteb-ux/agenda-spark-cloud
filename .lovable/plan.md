

## Plan: Arreglar "Atrasados" + agrupar Temas Activos por departamento/responsable

### Problemas detectados

**1. "Atrasados" cuenta temas cerrados con fecha vencida** (BUG)

En `generateReportPdf.ts` línea 326:
```ts
const od = list.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
```

Esto filtra **toda** la lista del responsable (activos + pausados + cerrados) por fecha vencida. Como `getTrafficLight` solo mira `due_date` sin importar el `status`, los temas cerrados después de su fecha original cuentan como "atrasados". Por eso ves 19 en vez de los ~3 reales.

**Fix**: Solo contar atrasados entre temas **activos/seguimiento** (no cerrados, no pausados):
```ts
const od = list.filter(t => 
  (t.status === 'activo' || t.status === 'seguimiento') &&
  getTrafficLight(t.due_date).label === 'Atrasado'
).length;
```

**2. Tabla "Temas Activos" sin agrupar**

Hoy lista 43 temas mezclados. Lo quieres agrupado por **departamento → responsable**, todos los temas de una persona juntos.

### Solución para Sección 1 — Temas Activos

Reemplazar la tabla única por **una tabla por departamento**, y dentro de cada departamento ordenar por responsable (todos los de Matías, luego todos los de Vicente, etc.).

Estructura visual:
```text
01  Temas Activos
    43 tema(s) en curso o seguimiento
─────────────────────────────────

▸ Administración y Finanzas (15 temas)
┌───┬──────────────────────┬──────────────┬────────┬────────┬──────────┬────────┐
│ # │ Tema                 │ Responsable  │ Inicio │ Vence  │ Estado   │ Avance │
├───┼──────────────────────┼──────────────┼────────┼────────┼──────────┼────────┤
│ 1 │ Tema A               │ Matías       │ ...    │ ...    │ Al día   │ —      │
│ 2 │ Tema B               │ Matías       │ ...    │ ...    │ Atrasado │ —      │
│ 3 │ Tema C               │ Vicente      │ ...    │ ...    │ Al día   │ —      │
│ … │                      │              │        │        │          │        │
└───┴──────────────────────┴──────────────┴────────┴────────┴──────────┴────────┘

▸ Operaciones (8 temas)
┌───┬──────────────────────┬──────────────┬────────┬────────┬──────────┬────────┐
│ … │                      │              │        │        │          │        │
└───┴──────────────────────┴──────────────┴────────┴────────┴──────────┴────────┘

▸ Sin departamento (3 temas)
…
```

**Lógica de orden**:
- Agrupar `activeTopics` por `department_id` (mapear a nombre vía `departments`).
- Departamentos en orden alfabético; "Sin departamento" al final.
- Dentro de cada departamento: ordenar por `assignee` alfabético, luego por `priority/order`.
- Renderizar un `autoTable` por departamento con un sub-encabezado.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/generateReportPdf.ts` | (1) Fix cálculo "Atrasados" en resumen por responsable. (2) Reescribir Sección 1: agrupar por departamento → responsable con una tabla por grupo. |

### También aplicar el fix al PDF Sección 1 columna "Estado"

Actualmente "Estado" usa `getTrafficLight(due_date)` que es correcto para activos. No se toca esa lógica. Solo se arregla el conteo "Atrasados" del resumen y se agrupa la tabla.

