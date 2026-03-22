

## Plan: Simplificar el PDF del informe — solo tablas, separadas por estado

### Problema
El PDF actual tiene demasiado texto con la sección "Detalle por Tema" (subtareas, bitácoras, barras de progreso por cada tema). Se vuelve infinito. Las tablas necesitan ajustes.

### Cambios en `src/lib/generateReportPdf.ts`

#### 1. Tabla "Logros del Período" (Completados)
- Agregar columna **Fecha Cierre** (usar `updated_at` del tema como fecha de cierre)
- Agregar columna **Último Comentario** (último entry de `progress_entries`)
- Eliminar columna Prioridad (no aporta valor aquí)
- Ajustar anchos de columna para que el texto quepa bien

#### 2. Eliminar sección "Detalle por Tema"
- Borrar completamente el bloque que renderiza cada tema con subtareas, barras de progreso, bitácoras individuales (~líneas 267-395)
- Esto es lo que hace el PDF infinito

#### 3. Separar "Semáforo General" en dos tablas por estado
- **Temas Activos** (status `activo` + `seguimiento`) — tabla con semáforo como está ahora
- **Temas en Pausa** (status `pausado`) — tabla separada con header diferente (color gris/slate)

#### 4. Mantener las secciones que sí aportan
- Header con título/autor ✓
- KPIs ejecutivos ✓
- Narrativa breve ✓
- Resumen por Responsable ✓
- Footer ✓

### Archivo a modificar
- `src/lib/generateReportPdf.ts`

