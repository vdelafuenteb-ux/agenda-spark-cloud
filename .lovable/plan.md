

## Plan: Filtro de estado en pestaña "Temas" del perfil + fix de estilo completados

### Problemas

1. **Temas completados aparecen en rojo** porque `isStoredDateOverdue` evalúa la fecha de vencimiento sin importar si ya está cerrado
2. **No hay filtro de estado** — se muestran todos los temas mezclados (activos, completados, pausados)

### Cambios en `src/components/AssigneeProfileView.tsx`

1. **Nuevo estado `topicStatusFilter`** con valor por defecto `'activos'` (muestra activo + seguimiento)
   - Opciones: "Activos" (activo + seguimiento), "Completados", "Pausados", "Todos"

2. **Select de filtro** en el header de la card de temas, al lado del título "Todos los temas"

3. **Filtrar `metrics.assigneeTopics`** según el filtro seleccionado antes de renderizar la tabla

4. **Fix overdue styling**: no aplicar `bg-destructive/5` ni texto rojo a temas con `status === 'completado'` — un tema cerrado no está "atrasado"

### Flujo
- Por defecto el usuario ve solo temas activos y en seguimiento
- Puede cambiar a "Completados", "Pausados" o "Todos" con el Select
- El contador en el header refleja los temas filtrados
- Temas completados nunca muestran estilo de "atrasado"

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Agregar estado + Select de filtro, filtrar temas en tabla, fix overdue para completados |

