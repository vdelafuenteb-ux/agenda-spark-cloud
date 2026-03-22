

## Plan: Rediseño del modal de informe — selección rápida de temas y subtareas

### Problema actual
- La personalización y selección de temas están escondidas en collapsibles que hay que abrir manualmente.
- No se puede controlar si las subtareas de un tema específico se muestran o no en el PDF.
- La experiencia no es rápida ni ejecutiva.

### Diseño propuesto

Reestructurar el modal en **2 zonas claras** sin collapsibles innecesarios:

**Zona superior (configuración rápida):** Una fila compacta con título, autor, cargo, periodo — siempre visible, sin necesidad de abrir nada.

**Zona principal (selector de temas):** Lista de todos los temas agrupados por estado, cada uno con:
- Un checkbox para incluir/excluir el tema del informe
- Un botón expandir (▸) que muestra las subtareas con checkboxes individuales
- Info rápida: responsable, semáforo, estado
- Botones "Todos / Ninguno" por sección de estado

**Zona inferior:** Switches de secciones (Logros, Bitácora, Responsables) + botones de acción (PDF, Emitir).

### Cambios en el PDF
- Pasar al generador un mapa `topicSubtaskFilter: Record<string, string[]>` que indica qué subtareas incluir por tema.
- En `buildIntegratedRows`, filtrar subtareas según este mapa.
- En `PdfOptions`, agregar `subtaskFilter?: Record<string, string[]>`.

### Archivos a modificar

**`src/components/ReportModal.tsx`** (reescritura mayor):
- Eliminar collapsibles de personalización y selector de temas
- Layout: config rápida arriba → selector de temas con subtareas expandibles → switches + acciones abajo
- Nuevo estado: `excludedSubtaskIds: Set<string>` para trackear subtareas desactivadas
- Agrupar temas por estado (Activos, Seguimiento, Completados, Pausados) con headers
- Cada tema: checkbox + expand toggle → subtareas con checkboxes
- Pasar `subtaskFilter` al PDF generator

**`src/lib/generateReportPdf.ts`**:
- `PdfOptions`: agregar `subtaskFilter?: Record<string, string[]>`
- En `buildIntegratedRows`: si `subtaskFilter` existe, solo incluir subtareas listadas
- Actualizar conteos de avance para respetar el filtro

### Flujo de usuario
1. Abre el modal → ve todo de una vez: config + lista de temas con checkboxes
2. Click en tema → lo activa/desactiva
3. Click en ▸ junto al tema → expande subtareas con checkboxes individuales
4. Ajusta switches de secciones
5. Click "Emitir Informe" o "PDF"

