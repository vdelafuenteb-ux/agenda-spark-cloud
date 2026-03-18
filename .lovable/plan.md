

## Plan: Informe Ejecutivo Profesional con Historial y Filtros

### Cambios en el informe generado (`ReportModal.tsx`)

El informe se enfocara **solo en temas activos** y sera mas profesional:

1. **Solo temas activos** - Eliminar secciones de completados/pausados del contenido
2. **Semaforos de atraso** por tema:
   - `🟢` Al dia (sin due_date o due_date > hoy)
   - `🟡` Proximo a vencer (due_date dentro de 3 dias)
   - `🔴` Atrasado (due_date < hoy)
3. **Novedades resaltadas** - Mostrar las progress_entries mas recientes (dentro del periodo seleccionado) marcadas como "**NUEVO**"
4. **Subtareas recientes** - Marcar subtareas creadas dentro del periodo con indicador de nueva
5. **Auto-guardar al emitir** - Al hacer clic en "Emitir Informe" se guarda automaticamente en la DB e invalida la query de reports
6. **Formato ejecutivo mejorado**: resumen con KPIs, tabla de semaforos, detalle por tema

### Cambios en la vista de informes (`ReportsList.tsx`)

Reescribir para ser una vista completa con:

1. **Buscador** - Input de busqueda por titulo
2. **Filtro por fecha** - Selector de rango de fechas para filtrar informes por `created_at`
3. **Lista de informes** con titulo, fecha de emision, periodo cubierto
4. **Expandir informe** - Click para ver contenido completo renderizado
5. **Acciones** - Copiar, imprimir, eliminar por informe
6. **Boton "Nuevo Informe"** en la cabecera que abre el modal

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/ReportModal.tsx` | Reescribir generacion de informe: solo activos, semaforos, novedades, auto-guardado |
| `src/components/ReportsList.tsx` | Agregar buscador, filtros por fecha, boton nuevo informe, mejor UI |
| `src/pages/Index.tsx` | Pasar `setReportOpen` a ReportsList para que pueda abrir el modal desde la vista de informes |

### No se requieren cambios de base de datos
La tabla `reports` ya tiene todos los campos necesarios (title, content, period_start, period_end, created_at).

