

## Plan: Reestructurar informe PDF agrupando por departamento

### Cambio solicitado
Cambiar la estructura del PDF de "por estado" a "por departamento". Cada departamento se completa íntegramente (Activos → Pausados → Cerrados) antes de pasar al siguiente.

### Estructura nueva

**Página 1 — Resumen Ejecutivo** (sin cambios)
- KPIs globales, alertas críticas, resumen por responsable

**Páginas 2+ — Detalle por Departamento**

Por cada departamento (alfabético, "Sin departamento" al final):

```text
═══════════════════════════════════════
  ADMINISTRACIÓN Y FINANZAS
  15 activos · 2 pausados · 8 cerrados
═══════════════════════════════════════

  ▸ Activos (15)
  ┌──┬──────────┬─────────────┬───────┬───────┬──────────┐
  │ #│ Tema     │ Responsable │ Inicio│ Vence │ Estado   │
  └──┴──────────┴─────────────┴───────┴───────┴──────────┘

  ▸ Pausados (2)
  ┌──────────┬─────────────┬─────────────┬──────────────┐
  │ Tema     │ Responsable │ Pausado desde│ Razón       │
  └──────────┴─────────────┴─────────────┴──────────────┘

  ▸ Cerrados (8)
  ┌──────────┬─────────────┬───────────┬──────────────┐
  │ Tema     │ Responsable │ Cerrado el│ Cumplimiento │
  └──────────┴─────────────┴───────────┴──────────────┘

  [Page break]

═══════════════════════════════════════
  OPERACIONES
  ...
```

### Reglas

- Cada departamento empieza en página nueva con header destacado.
- Dentro del departamento: orden fijo Activos → Pausados → Cerrados.
- Si una sub-sección no tiene temas, se omite (no muestra tabla vacía).
- Dentro de cada sub-sección: ordenar por responsable (alfabético), luego por orden de ejecución.
- "Cerrados" sigue filtrado por el rango de fechas seleccionado.
- "Sin departamento" al final.

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/lib/generateReportPdf.ts` | Reemplazar las 3 secciones globales (Activos/Pausados/Cerrados) por bucle por departamento, manteniendo el resumen ejecutivo de página 1 intacto. |

