

## Plan: Agrandar fuentes y espaciado en la primera página del resumen ejecutivo

La primera página tiene contenido que se ve pequeño y no aprovecha todo el espacio disponible. Se aumentarán las fuentes y el espaciado para que ocupe la hoja completa.

### Cambios en `src/lib/generateReportPdf.ts`

**1. Cumplimiento de Cierre** (líneas ~307-317)
- Eliminar la sección visual de cumplimiento de cierre (barra de progreso) que quedó — solo mantener el cálculo para la narrativa

**2. KPI boxes** (líneas ~290-305)
- Aumentar `kpiH` de 17 a 20
- En `drawKpiBox`: valor de 13pt a 15pt, label de 6pt a 7pt, ajustar posiciones Y

**3. Header** (líneas ~232-269)
- Título de 18pt a 20pt
- Periodo de 9pt a 10pt
- Autor de 9pt a 10pt
- Más espaciado entre líneas (de 4.5 a 5.5)

**4. Sección "Resumen Ejecutivo"** (línea ~284-288)
- Título de 11pt a 13pt
- Más espacio después del título

**5. Alertas de Atraso** (líneas ~325-347)
- Título de 9pt a 11pt
- Items de 7pt a 8.5pt
- Más espaciado entre items (3.5 → 4.5)

**6. Narrativa** (líneas ~353-365)
- De 8pt a 9pt
- Más line height (3.5 → 4.5)

**7. Tabla de Responsables** (líneas ~379-425)
- Título de 9pt a 11pt
- Font de tabla de 7pt a 8pt
- cellPadding de 1.8 a 2.5
- Head fontSize de 7pt a 8pt
- Expandir `tableW` de 160 a usar todo `contentW`

### Archivo a modificar
- `src/lib/generateReportPdf.ts`

