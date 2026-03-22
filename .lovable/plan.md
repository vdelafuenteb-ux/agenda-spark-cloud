

## Plan: Reestructurar Notas con jerarquía Libreta → Tema → Nota y vista mosaico

### Estructura actual
- Libreta (notebook) → Notas directamente
- Vista: lista plana en panel lateral

### Nueva estructura
- **Libreta** (notebook) → **Temas** (note_sections, sub-agendas) → **Notas**
- Navegación por niveles: primero ves libretas en mosaico, entras a una y ves sus temas, entras a un tema y ves sus notas

### Cambios

#### 1. Base de datos
- Crear tabla `note_sections` con columnas: `id`, `user_id`, `notebook_id` (FK), `name`, `color`, `created_at`, `sort_order`
- Agregar columna `section_id` (nullable) a tabla `notes` para vincular notas a un tema/sección
- RLS policies estándar por `user_id` en `note_sections`, y para notes via notebook ownership

#### 2. Hook `useNotes.tsx`
- Agregar interfaz `NoteSection` y query para `note_sections`
- CRUD mutations: `createSection`, `updateSection`, `deleteSection`
- Actualizar `createNote` para aceptar `section_id`
- Actualizar `updateNote` para permitir mover nota entre secciones

#### 3. Vista principal `NotesView.tsx` - Rediseño completo
- **3 niveles de navegación** con estado: `currentView = 'notebooks' | 'sections' | 'notes' | 'editor'`
- **Nivel 1 - Libretas (mosaico)**: Cards grandes con color, nombre, cantidad de temas y notas. Botón crear libreta. Toggle vista mosaico/lista
- **Nivel 2 - Temas dentro de libreta**: Al hacer clic en una libreta, muestra sus temas como cards. Breadcrumb "Notas > Transit". Botón crear tema
- **Nivel 3 - Notas dentro de tema**: Lista de notas del tema seleccionado, ordenadas por fecha desc. Botón crear nota (se asigna automáticamente al tema actual)
- **Nivel 4 - Editor**: El NoteEditor existente con botón volver

#### 4. Componente `NotebookGrid.tsx` (nuevo)
- Vista mosaico de libretas como cards grandes (ej: 3 columnas)
- Cada card muestra: icono libro con color, nombre, conteo de temas, conteo de notas, fecha última actualización
- Hover con efecto sutil, click navega al nivel de temas

#### 5. Componente `SectionList.tsx` (nuevo)
- Vista de temas dentro de una libreta (cards medianas o lista)
- Breadcrumb de navegación arriba
- Crear/renombrar/eliminar temas
- Click navega al nivel de notas

#### 6. Al crear nota
- Si estás dentro de un tema, se asigna automáticamente a esa libreta y tema
- Si estás en "Todas las notas", un selector permite elegir libreta → tema

#### 7. Ordenamiento
- Notas ordenadas por `updated_at` descendente (ya funciona así)
- Temas ordenados por `sort_order` o nombre

### Flujo de usuario
```text
[Mosaico Libretas] → click "Transit" → [Temas de Transit] → click "Facturas" → [Notas de Facturas] → click nota → [Editor]
```

### Archivos a modificar/crear
- **Migración SQL**: crear `note_sections`, agregar `section_id` a `notes`
- **`useNotes.tsx`**: agregar secciones al hook
- **`NotesView.tsx`**: rediseño con navegación multinivel
- **`NotebookGrid.tsx`** (nuevo): vista mosaico de libretas
- **`SectionList.tsx`** (nuevo): lista de temas dentro de libreta
- **`NotebookList.tsx`**: se reemplaza por NotebookGrid en la vista principal
- **`NoteEditor.tsx`**: actualizar props para incluir secciones

