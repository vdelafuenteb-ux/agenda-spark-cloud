

## Plan: Checklist Rápido del Día

### Qué se hará

Nueva sección "Checklist" en el sidebar — una lista simple y rápida de tareas del día para anotar cosas al vuelo. Diseñada para velocidad: escribir, Enter, listo.

### Cambios en base de datos

**Nueva tabla `checklist_items`:**
- `id` uuid PK
- `user_id` uuid NOT NULL
- `title` text NOT NULL
- `completed` boolean DEFAULT false
- `created_at` timestamptz DEFAULT now()
- RLS: cada usuario solo ve/crea/edita/borra los suyos.

### Cambios en UI

**1. `src/components/AppSidebar.tsx`**
- Agregar filtro `'checklist'` con icono `CheckSquare`.
- Actualizar tipo `Filter`.

**2. `src/pages/Index.tsx`**
- Agregar `'checklist'` al tipo `Filter`.
- Renderizar `<ChecklistView />` cuando `filter === 'checklist'`.

**3. Nuevo: `src/components/ChecklistView.tsx`**
- Input arriba: escribir texto + Enter para agregar item instantáneamente.
- Lista de items con checkbox para marcar completados.
- Items completados se muestran tachados abajo.
- Botón "Limpiar completados" para borrar los ya hechos.
- Diseño minimalista y rápido, sin modales ni formularios complejos.

**4. Nuevo: `src/hooks/useChecklist.tsx`**
- Hook con React Query para CRUD de `checklist_items`.
- Mutations: crear, toggle completado, eliminar, limpiar completados.

