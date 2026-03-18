

## Plan: Gestión de Etiquetas y Responsables

### Qué se hará

Agregar una nueva sección "Configuración" en el sidebar donde el usuario pueda ver, editar y eliminar sus etiquetas y responsables guardados.

### Cambios

**1. `src/components/AppSidebar.tsx`**
- Agregar filtro `'configuracion'` con icono `Settings`.
- Ubicarlo antes de "Cerrar sesión" en el footer o al final de la lista de filtros.

**2. `src/pages/Index.tsx`**
- Agregar `'configuracion'` al tipo `Filter`.
- Renderizar `<SettingsView />` cuando `filter === 'configuracion'`.
- Pasar `tags`, `assignees` y sus mutations.

**3. Nuevo: `src/components/SettingsView.tsx`**
- Dos secciones con cards: **Etiquetas** y **Responsables**.
- **Etiquetas**: Lista todas las etiquetas con su color, nombre, y botón de eliminar (con confirmación via AlertDialog). Opción de crear nuevas desde aquí también.
- **Responsables**: Lista todos los responsables con botón de eliminar (con confirmación). Opción de crear nuevos.
- Al eliminar una etiqueta, las asociaciones `topic_tags` se eliminan en cascada (ya manejas `deleteTag` en `useTags`). Igual con responsables, pero hay que verificar que los temas que tengan ese `assignee` como texto no queden huérfanos — se mostrará un aviso.
- Diseño simple: lista vertical con nombre a la izquierda y acciones a la derecha.

### Sin cambios en base de datos
Las mutations `deleteTag` y `deleteAssignee` ya existen en los hooks. Solo falta exponerlos en la UI.

