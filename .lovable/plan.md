

## Plan: Página 1 = Resumen Ejecutivo puro, detalle desde página 2

### Concepto
Como presidente ejecutivo, la primera página debe ser una radiografía rápida: KPIs, logros del periodo (solo nombres, sin subtareas), alertas de atraso, y cumplimiento de cierre. Todo lo demás (tablas detalladas con subtareas, responsables, etc.) arranca en página 2.

### Estructura de la Página 1 (Executive Summary)

1. **Header** — Logo + Título + Periodo + Autor (como está)
2. **KPIs** — Las 6 cajas actuales (Totales, Al Día, Próximos, Atrasados, Sin Fecha, Avance %)
3. **KPI de Cumplimiento de Cierre** — Mini caja o barra mostrando % de temas cerrados a tiempo vs con atraso
4. **Logros del Periodo** — Lista compacta solo con nombres de temas completados (sin tabla, sin subtareas, solo bullets con nombre + fecha de cierre)
5. **Alertas de Atraso** — Lista compacta de temas atrasados con responsable y días de atraso
6. **Narrativa** — Párrafo resumen ejecutivo
7. **Forzar salto de página** después de esta sección

### Desde Página 2 en adelante (Detalle)
- Tabla de Resumen por Responsable
- Sección "Logros del Periodo" con tabla detallada (subtareas, comentarios)
- Sección "Temas Activos" con tabla detallada
- Sección "Temas en Pausa" con tabla detallada

### Cambios en `src/lib/generateReportPdf.ts`

**Página 1 — después de KPIs actuales, agregar:**

- **Cumplimiento de cierre**: calcular temas con `closed_at` y `due_date`, mostrar % a tiempo como una mini KPI box adicional o una barra de progreso dibujada
- **Logros compactos**: lista simple tipo bullet con `doc.text()` — solo "✓ Nombre del tema — cerrado dd MMM yyyy"
- **Alertas de atraso**: lista roja tipo "⚠ Nombre del tema — Responsable — X días de atraso"
- **`doc.addPage()`** forzado antes de las secciones detalladas

**Mover a página 2+:**
- La tabla de "Resumen por Responsable" (actualmente en página 1)
- Las secciones detalladas (renderSection) de Logros, Activos, Pausados

### Archivo a modificar
1. **`src/lib/generateReportPdf.ts`** — Reorganizar el flujo para que página 1 sea solo resumen ejecutivo compacto, y el detalle completo arranque en página 2

