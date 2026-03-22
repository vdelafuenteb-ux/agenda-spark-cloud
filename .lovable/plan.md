

## Plan: Rediseño ejecutivo del PDF - Nivel gerencial

### Problema actual
- Subtareas se muestran en tablas separadas con headers morados repetitivos, creando ruido visual
- Los separadores de departamento son poco visibles (rectángulo morado pequeño)
- Exceso de morado en headers de subtareas (`PURPLE_100`, `PURPLE_50`) - poco profesional
- Los caracteres `%E` y `▸` se ven mal en el PDF
- Estructura fragmentada: tabla principal + N tablas de subtareas por tema

### Nuevo enfoque: estructura integrada por capítulo

En lugar de tablas separadas para subtareas, se integra todo en una sola tabla por departamento con filas indentadas para subtareas.

#### Cambios en `src/lib/generateReportPdf.ts`

**1. Departamento como encabezado de capítulo**
- Reemplazar el rectángulo morado por un texto grande en negrita con una línea fina gris debajo (estilo capítulo ejecutivo)
- Numeración: "1. Administración", "2. Finanzas", etc.

**2. Eliminar `drawSubtaskDetails` separado**
- Integrar subtareas como filas indentadas dentro de la tabla principal del tema
- Cada tema muestra sus subtareas debajo en la misma tabla, con texto indentado y fuente más pequeña
- Fondo blanco/gris alterno limpio, sin morado en subtareas

**3. Paleta reducida**
- Header del documento: morado oscuro (mantener)
- KPIs: mantener (están bien)
- Headers de tablas: gris oscuro (`SLATE_700`) en vez de morado
- Subtareas: filas en gris claro, sin header propio
- Solo usar color para: estado semáforo y KPIs

**4. Formato de subtareas integrado**
- En la tabla principal, después de cada fila de tema, insertar filas de subtareas con:
  - Columna 0: espacio en blanco (indentación visual)
  - Columna 1: `"  └ Nombre subtarea"` con fuente italic más pequeña
  - Responsable, fecha, último comentario en las columnas restantes
  - Fondo `SLATE_50` sin alternancia de color

### Resultado visual esperado

```text
═══════════════════════════════════════════
  INFORME EJECUTIVO          [Logo]
  Período: 01 mar — 22 mar 2026
═══════════════════════════════════════════

  [KPIs en cajas limpias]

  TEMAS ACTIVOS
  ─────────────────────────────────────────

  1. Administración
  ┌─────────────────────────────────────┐
  │ Tema │ Resp │ Prior │ Estado │ ...  │  <- header gris oscuro
  │──────│──────│───────│────────│──────│
  │ Patentes comerciales │ Yo │ ...    │  <- fila tema
  │   └ Global        │ — │ 31 mar │ — │  <- subtarea indentada
  │   └ Tecnología    │ — │ 31 mar │ — │  <- subtarea indentada
  │ Seguimiento Clientes │ Yo │ ...    │
  └─────────────────────────────────────┘

  2. Finanzas
  ┌─────────────────────────────────────┐
  │ ...                                 │
  └─────────────────────────────────────┘
```

### Archivos a modificar
- `src/lib/generateReportPdf.ts` — reescritura de la lógica de renderizado

