

## Plan: Categoría "Seguimiento" con Responsable

### Resumen

Agregar un nuevo estado "seguimiento" para temas asignados a trabajadores, con campo "responsable" y filtros dedicados. Visualmente diferenciados en todas las vistas.

### Cambios en base de datos

1. **Agregar valor al enum `topic_status`**: `ALTER TYPE topic_status ADD VALUE 'seguimiento';`
2. **Agregar columna `assignee`** (text, nullable) a la tabla `topics` para el nombre del responsable.

### Cambios en UI

**`src/pages/Index.tsx`**:
- Agregar tab "Seguimiento" junto a Activos/Pausados/Cerrados con su contador.
- Agregar filtro por responsable (dropdown con los nombres únicos de assignees) cuando el tab es "seguimiento".

**`src/components/FilterBar.tsx`**:
- Agregar prop opcional `assignees` y `selectedAssignee` con un dropdown "Filtrar por responsable".

**`src/components/TopicCard.tsx`**:
- Mostrar badge de responsable cuando el tema tiene `assignee`.
- Los temas con status "seguimiento" tendrán un borde/fondo de color diferenciado (por ejemplo, borde izquierdo azul-cyan o fondo tenue) para distinguirlos visualmente de los propios.
- Agregar al `statusLabels`: `seguimiento: 'Seguimiento'`.

**`src/components/CreateTopicModal.tsx`**:
- Agregar opción "Seguimiento" en el selector de estado.
- Cuando se selecciona "Seguimiento", mostrar campo de texto "Responsable" (obligatorio).

**`src/components/ReviewView.tsx`**:
- Los temas de seguimiento aparecen en revisión pero con estilo diferenciado (borde/badge de color distinto) para no confundirlos con los propios.

**`src/components/AppSidebar.tsx`**:
- Mostrar contador separado de temas en seguimiento en el sidebar.

**`src/hooks/useTopics.tsx`**:
- Sin cambios de lógica, la columna `assignee` se incluye automáticamente en `select('*')`.

### Flujo del usuario
1. Crea tema con status "Seguimiento" → aparece campo "Responsable" obligatorio.
2. En la vista de temas, tab "Seguimiento" muestra solo esos temas con badge del responsable.
3. Puede filtrar por responsable en ese tab.
4. En Revisión, los temas de seguimiento aparecen con color diferenciado.

