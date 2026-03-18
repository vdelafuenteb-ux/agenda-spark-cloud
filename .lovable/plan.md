

## Plan: Informes Ejecutivos con PDF y Selección de Temas

### Resumen

Dos cambios principales:
1. **Selector de temas** en el modal de informe: al abrir "Nuevo Informe", el usuario puede elegir qué temas incluir mediante checkboxes (por defecto todos los activos seleccionados).
2. **Generación de PDF** real usando la librería `jspdf` + `jspdf-autotable` para crear un PDF profesional y descargable con formato ejecutivo.

### Detección de novedades

Se mantiene el enfoque actual basado en período: subtareas y entradas de bitácora creadas dentro del período seleccionado se marcan como "NUEVO". No se compara contra informes anteriores ya que el enfoque por período es más claro y predecible.

### Cambios técnicos

**1. Instalar dependencia**
- Agregar `jspdf` y `jspdf-autotable` al proyecto.

**2. Modificar `ReportModal.tsx`**
- Agregar estado `selectedTopicIds: string[]` inicializado con todos los temas activos.
- Antes de la vista previa, mostrar una sección colapsable "Seleccionar temas" con checkboxes para cada tema activo (título + semáforo). Botones "Todos / Ninguno".
- Filtrar `activeTopics` por `selectedTopicIds` al generar el reporte.
- Reemplazar el botón "Imprimir" por "Descargar PDF".
- Crear función `handleDownloadPdf()` que genera un PDF usando `jspdf`:
  - Header con título "Informe Ejecutivo", período y fecha de emisión.
  - Tabla de KPIs.
  - Tabla semáforo general (tema, prioridad, semáforo, fecha cierre, progreso).
  - Sección por tema con subtareas, novedades marcadas con estrella, y bitácora.
  - Footer con fecha de generación.
  - Colores: rojo para atrasados, amarillo para próximos, verde para al día.

**3. Modificar `ReportsList.tsx`**
- Agregar botón "Descargar PDF" en cada informe guardado que regenere el PDF desde el contenido markdown almacenado.

**4. Actualizar `handleEmit`**
- Al emitir, también genera y descarga automáticamente el PDF.

### Flujo del usuario
1. Click "Nuevo Informe" → se abre modal.
2. Selecciona período (semana/mes/personalizado).
3. Despliega selector de temas y elige cuáles incluir.
4. Ve la vista previa del informe.
5. Click "Emitir Informe" → se guarda en BD y se descarga PDF automáticamente.
6. En historial de informes, puede volver a descargar el PDF de cualquier informe guardado.

