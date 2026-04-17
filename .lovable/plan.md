

## Plan: Rediseño del Informe Ejecutivo PDF

### Problema actual
El informe está desordenado, mezcla secciones, y no presenta los temas de forma clara y ejecutiva.

### Solución
Rediseñar `generateReportPdf.ts` con una estructura limpia de 3 secciones temáticas + resumen ejecutivo en página 1.

---

### Estructura del nuevo PDF

**Página 1 — Resumen Ejecutivo (alto impacto)**
- Header con título, autor, periodo
- 4 KPIs grandes: Total temas / Activos / Pausados / Cerrados
- Mini-tabla "Alertas críticas": atrasados + por vencer (top 5)
- Resumen por responsable (compacto)

**Página 2+ — Detalle por Secciones**

Cada sección inicia en página nueva con título grande:

1. **SECCIÓN 1 — TEMAS ACTIVOS** (incluye activos en curso, archivados, en seguimiento — todo lo que esté en estado `activo`, archivado o no)
   - Tabla agrupada por departamento → responsable
   - Columnas: P# / Tema / Responsable / Inicio / Vence / Estado plazo / Avance

2. **SECCIÓN 2 — TEMAS PAUSADOS**
   - Tabla con: Tema / Responsable / Pausado desde / Razón

3. **SECCIÓN 3 — TEMAS CERRADOS**
   - Tabla con: Tema / Responsable / Cerrado el / Cumplimiento (a tiempo/atraso)
   - Filtrado por el rango de fechas seleccionado (por `closed_at`)

---

### Cambios en `ReportModal.tsx`

- Mantener selector de periodo (semana/mes/personalizado) — ya filtra cerrados por fecha
- Simplificar switches: solo "Incluir bitácora" y "Incluir responsables"
- Eliminar la complejidad actual de selección manual tema-por-tema (queda implícito: todos los del periodo)
- Botones: Descargar PDF / Guardar informe

---

### Cambios en `generateReportPdf.ts`

- Reescribir `generateReportPdf()` con la nueva estructura de 3 secciones claras
- Nueva función `renderExecutiveSummary()` para página 1
- Nueva función `renderActiveSection()`, `renderPausedSection()`, `renderClosedSection()`
- Estilo ejecutivo: tipografía clara, espaciado generoso, colores sobrios (azul/gris/rojo solo para alertas)
- Footers con número de página y "Confidencial"

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/generateReportPdf.ts` | Reescritura del layout en 3 secciones + portada ejecutiva |
| `src/components/ReportModal.tsx` | Simplificar UI manteniendo filtro por fechas |

