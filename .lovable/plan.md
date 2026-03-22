

## Plan: Eliminar previsualización markdown del modal de informe

El usuario no usa la previsualización del markdown que se muestra en el modal. Solo necesita configurar, seleccionar temas/subtareas, y generar el PDF.

### Cambio

**`src/components/ReportModal.tsx`**:
- Eliminar la generación del `report` markdown (el `useMemo` grande que construye el string markdown) — solo mantener lo necesario para guardar en BD al "Emitir"
- Eliminar el botón "Copiar" que copia el markdown
- Mantener: config rápida, selector de temas, switches, botones PDF y Emitir Informe
- El markdown para guardar en BD se puede generar solo al momento de emitir (inline en `handleEmit`), no necesita estar en un `useMemo` reactivo

