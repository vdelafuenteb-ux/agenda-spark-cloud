

## Plan: Filtrar solo temas activos + mostrar fechas en resumen de cada tema

### Cambios

**1. `supabase/functions/validate-update-token/index.ts` — Filtrar solo temas activos**
- Línea 54: cambiar `.neq("status", "completado")` a filtrar solo status `activo` y `seguimiento`, excluyendo `pausado`, `completado` y cualquier otro.
- Agregar: `.in("status", ["activo", "seguimiento"])` en vez de `.neq("status", "completado")`
- También incluir `created_at` en el select de topics (línea 51).

**2. `src/pages/UpdateTopics.tsx` — Mostrar fechas de creación y vencimiento**
- Agregar `created_at` al interface `TopicData`.
- En el header colapsado de cada tema, mostrar debajo del título: "Creado: 15-mar-2026 · Vence: 30-mar-2026" para que el responsable vea claramente las fechas.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/validate-update-token/index.ts` | Filtrar `.in("status", ["activo", "seguimiento"])` + incluir `created_at` en select |
| `src/pages/UpdateTopics.tsx` | Agregar `created_at` a interface, mostrar fechas creación/vencimiento en header de cada tema |

