

## Plan: Unificar "Mi día", "Atrasados" y "Próximos a vencer" en una vista "Revisión"

### Concepto

Reemplazar el filtro "Mi día" y "Prioridad Alta" del sidebar por una nueva entrada **"Revisión"** (icono `ClipboardCheck` o `Eye`) que al seleccionarla muestra una vista con **3 sub-pestanas** internas:

1. **Mi día** - Temas/subtareas con fecha de hoy
2. **Atrasados** 🔴 - Temas con `due_date < hoy` (activos)
3. **Próximos** 🟡 - Temas con `due_date` dentro de los próximos 3 días (activos)

### Cambios en el Sidebar (`AppSidebar.tsx`)

- Eliminar los filtros `hoy` y `alta`
- Agregar filtro `revision` con icono `Eye`
- Sidebar queda: `todos`, `revision`, `informes`, `notas`
- Mostrar contadores en la entrada de Revisión (ej: badge con cantidad de atrasados)

### Cambios en el tipo Filter

- `type Filter = 'todos' | 'revision' | 'informes' | 'notas'`
- Eliminar `hoy` y `alta`

### Nueva vista de Revisión en `Index.tsx`

Cuando `filter === 'revision'`, renderizar una vista con `Tabs` con 3 sub-pestanas:

- **Mi día**: filtra temas activos con `due_date` = hoy o subtareas con `due_date` = hoy
- **Atrasados**: filtra temas activos con `due_date` < hoy (usa `parseStoredDate` + `isBefore`)
- **Próximos a vencer**: filtra temas activos con `due_date` entre hoy y hoy+3 días

Cada sub-pestaña muestra los `TopicCard` correspondientes con los mismos controles existentes. El tab de Atrasados muestra un badge rojo con la cantidad.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/AppSidebar.tsx` | Cambiar filtros: quitar `hoy`/`alta`, agregar `revision` con badge de atrasados |
| `src/pages/Index.tsx` | Cambiar tipo Filter, agregar lógica de sub-tabs para la vista Revisión con las 3 pestanas |
| `src/lib/date.ts` | Agregar helper `isStoredDateOverdue` y `isStoredDateUpcoming(days)` |

