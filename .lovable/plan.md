

## Plan: Corregir agrupación por departamento en PDF

### Problema raíz
En `ReportModal.tsx` línea 311-321, la función `handleEmit` llama a `downloadReportPdf` **sin pasar la prop `departments`**. Sin esa data, `groupByDepartment` no puede resolver los nombres y todo cae en "Sin Departamento".

La función `handleDownloadPdf` (línea 281-294) sí lo pasa correctamente, por eso solo falla al "emitir".

### Cambio

#### `src/components/ReportModal.tsx`
- Línea 311-321: Agregar `departments` al objeto de opciones en `handleEmit`, igual que ya se hace en `handleDownloadPdf`.

```typescript
downloadReportPdf({
  topics: selectedTopics,
  periodStart: start,
  periodEnd: end,
  title: reportTitle,
  authorName: authorName || undefined,
  authorRole: authorRole || undefined,
  includeCompleted,
  includeBitacora,
  includeResponsables,
  departments,  // <-- agregar esta línea
});
```

### Impacto
Un solo archivo, una línea agregada. El agrupamiento por departamento ya funciona correctamente en `generateReportPdf.ts` — solo faltaba pasar los datos.

