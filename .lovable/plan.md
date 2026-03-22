

## Plan: Rediseñar el sistema de Informes Ejecutivos

### Contexto
El informe actual solo incluye temas activos con un formato básico. El usuario necesita un informe profesional y completo para entregar a su jefe, que cubra TODO lo que pasó en un período: temas cerrados, activos, atrasados, responsables, bitácoras, y un resumen ejecutivo. Debe ser personalizable antes de exportar.

### Cambios principales

#### 1. `ReportModal.tsx` - Rediseñar el modal con opciones de personalización

**Incluir TODOS los estados** (no solo activos):
- Selector para incluir: Activos, Seguimiento, Completados, Pausados
- Filtro por responsable (incluyendo "Yo" para sin asignar)
- Campo editable para título del informe
- Campo editable para nombre del autor / cargo (ej: "Gerente General Interino")
- Toggle para incluir/excluir secciones: Resumen Ejecutivo, Temas Cerrados, Bitácoras, Responsables

**Mejorar el contenido del informe generado (Markdown):**
- Resumen Ejecutivo narrativo (no solo KPIs en tabla)
- Secciones separadas: Logros del Período (cerrados), Temas Activos, Atrasados/Alertas, Responsables
- Cada tema con su responsable visible
- Bitácora resumida por tema

#### 2. `generateReportPdf.ts` - Rediseñar el PDF profesional

**Nuevo diseño visual inspirado en el estilo del usuario** (colores oscuros, limpio, ejecutivo):
- Header con franja azul oscuro (#1E293B), título grande, subtítulo con cargo/autor, período y fecha de emisión
- Resumen Ejecutivo con KPIs en cards/cajas visuales (no solo tabla)
- Sección "Logros del Período" - temas completados con fecha de cierre
- Tabla Semáforo con columna de Responsable
- Detalle por tema: barra de color lateral, responsable, subtareas, bitácora reciente
- Sección de Responsables: tabla resumen de qué responsable tiene qué temas y su estado
- Footer con paginación y marca de generación automática
- Diseño más compacto pero legible, fuentes limpias

#### 3. Nuevas opciones de `PdfOptions`

```typescript
interface PdfOptions {
  topics: TopicWithSubtasks[];
  periodStart: Date;
  periodEnd: Date;
  title?: string;
  authorName?: string;
  authorRole?: string;
  includeCompleted?: boolean;
  includeBitacora?: boolean;
  includeResponsables?: boolean;
}
```

### Archivos a modificar
- **`src/components/ReportModal.tsx`**: Agregar controles de personalización, incluir todos los estados, mejorar Markdown
- **`src/lib/generateReportPdf.ts`**: Rediseñar PDF completo con nuevo layout profesional, secciones de completados, responsables, resumen ejecutivo narrativo

### Resultado esperado
Un informe que al abrirlo el jefe vea: resumen ejecutivo claro, qué se logró, qué está pendiente, quién es responsable de qué, alertas de atraso, y el estado actual de cada tema. Profesional, limpio, fácil de leer.

