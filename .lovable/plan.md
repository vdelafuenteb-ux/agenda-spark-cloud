

## Lista de Contactos

Agregar una nueva sección "Contactos" en la app donde el usuario pueda gestionar una lista de contactos con nombre, correo, cargo, celular y empresa, con búsqueda rápida.

### Cambios

**1. Migración SQL -- nueva tabla `contacts`**
- Columnas: `id` (uuid PK), `user_id` (uuid), `name` (text), `email` (text), `phone` (text), `position` (text, cargo), `company` (text), `created_at` (timestamptz)
- RLS: CRUD scoped a `auth.uid() = user_id`

**2. `src/types/filters.ts`**
- Agregar `'contactos'` al tipo `Filter`

**3. `src/components/AppSidebar.tsx`**
- Agregar entrada "Contactos" con icono `Contact` (lucide) en la lista de filtros del sidebar

**4. `src/hooks/useContacts.tsx`** (nuevo)
- Hook con React Query para CRUD de contactos: `useQuery(['contacts'])`, `createContact`, `updateContact`, `deleteContact`

**5. `src/components/ContactsView.tsx`** (nuevo)
- Vista principal con:
  - Barra de búsqueda rápida (filtra por nombre, email, empresa, cargo)
  - Botón "Nuevo Contacto" que abre un dialog/formulario inline
  - Tabla/lista de contactos mostrando nombre, correo, cargo, celular, empresa
  - Edición inline o via dialog al hacer clic
  - Botón eliminar con confirmación
- Diseño responsive: tabla en desktop, cards en móvil

**6. `src/pages/Index.tsx`**
- Importar `ContactsView`
- Agregar condicional `filter === 'contactos'` para renderizar la vista
- Agregar título "Contactos" al header

### Archivos a crear/modificar
- 1 migración SQL
- `src/types/filters.ts`
- `src/components/AppSidebar.tsx`
- `src/hooks/useContacts.tsx` (nuevo)
- `src/components/ContactsView.tsx` (nuevo)
- `src/pages/Index.tsx`

