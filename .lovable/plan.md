

## Plan: Ajustes al PDF del Informe Ejecutivo

### Problemas identificados y soluciones

**1. Logo demasiado grande y con fondo gris**
- Reducir `logoSize` de 16 a 10mm
- Mantener proporciones cuadradas pero más discreto junto al título

**2. "Yo" sigue apareciendo en vez del nombre del autor**
- El `ownerName` ya se define como `authorName || 'Yo'` y se pasa a `buildIntegratedRows` y `groupByDepartment`
- Revisar que en `buildIntegratedRows` el `ownerName` se use correctamente como fallback para `t.assignee`
- El problema real: en la tabla de responsables, los temas sin `assignee` se agrupan bajo `ownerName`, pero si el usuario no tiene `authorName` configurado cae en "Yo". Verificar que `ReportModal` pase correctamente `authorName`.

**3. Tabla "Logros del Periodo" con encabezado verde → cambiar a SLATE_700 (igual que las demás)**
- En `renderSection('Logros del Periodo', completedTopics, 'completed', GREEN)` cambiar `GREEN` por `SLATE_700`

**4. Agregar columna de ticket verde (✓) para completados**
- En la sección "completed", agregar una columna "Estado" con "✓" en verde para temas completados
- Actualizar `heads.completed` y `buildIntegratedRows` para incluir esta columna

**5. Enumerar tareas por departamento con numeración jerárquica (3.1, 3.2)**
- En `buildIntegratedRows`, recibir el índice del grupo (`gi`) para numerar
- Cada tema dentro del departamento se numera: si es departamento 1, temas son 1.1, 1.2, 1.3...
- Subtareas se numeran: 1.1.1, 1.1.2, etc. (o 3.1, 3.2 si el tema es el 3)
- Actualizar la primera columna para incluir esta numeración

### Archivos a modificar

- `src/lib/generateReportPdf.ts`:
  - Logo: reducir tamaño (línea 211)
  - Sección completados: cambiar `GREEN` → `SLATE_700` (línea 449)
  - `buildIntegratedRows`: agregar parámetro `groupIndex`, numerar temas y subtareas, agregar columna "✓" para completed
  - `heads.completed`: agregar columna "Estado" con ✓
  - `colStyles.completed`: ajustar anchos

- `src/components/ReportModal.tsx`: verificar que `authorName` se pase correctamente al PDF

