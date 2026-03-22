

## Plan: Nombre del PDF igual al título del informe

### Cambio único

**`src/lib/generateReportPdf.ts`** (línea 517):
- Cambiar el nombre del archivo de `informe_YYYYMMDD_YYYYMMDD.pdf` a usar `options.title` (el título que el usuario escribe en el modal)
- Sanitizar caracteres inválidos para nombre de archivo (`/\:*?"<>|`)
- Fallback a "Informe Ejecutivo" si no hay título

```typescript
// Antes:
const fileName = `informe_${format(...)}_${format(...)}.pdf`;

// Después:
const baseName = (options.title || 'Informe Ejecutivo').replace(/[\/\\:*?"<>|]/g, '_').trim();
const fileName = `${baseName}.pdf`;
```

Mismo cambio aplica a `downloadPdfFromContent` (línea 562) usando el parámetro `title`.

