

## Plan: Sistema de Notas con Libretas y Categorias

### Modelo de datos (3 tablas nuevas)

```text
notebooks                    notes                        note_tags
-----------                  -----------                  -----------
id (uuid PK)                 id (uuid PK)                 id (uuid PK)
user_id (uuid)               user_id (uuid)               note_id -> notes
name (text)                  notebook_id -> notebooks     tag_id -> tags
color (text, default)        title (text)
created_at (timestamptz)     content (text)               (reutiliza tabla tags existente)
                             created_at (timestamptz)
                             updated_at (timestamptz)
```

- Se reutiliza la tabla `tags` existente para etiquetar notas (sub-etiquetas dentro de libretas).
- `notebooks` son los "libros de notas" (ej. Finanzas, Personal).
- `notes` almacena el contenido con soporte de texto enriquecido (HTML/markdown en el campo `content`).
- Imagenes pegadas (Ctrl+V) se suben a un bucket de Storage `note-images` y se insertan como `<img>` en el contenido.

### Storage

- Crear bucket `note-images` (publico) para las imagenes pegadas en notas.

### RLS

- Todas las tablas con politicas basadas en `auth.uid() = user_id` (notebooks, notes) o via JOIN a notes (note_tags).

### Navegacion

- Agregar entrada "Notas" al sidebar (`AppSidebar.tsx`) con icono `StickyNote`.
- Nuevo filtro `'notas'` que se agrega al tipo `Filter`.
- Cuando el filtro es `'notas'`, `Index.tsx` renderiza el componente `<NotesView />` en lugar de los temas.

### Componentes nuevos

1. **`NotesView.tsx`** - Vista principal con layout de 2 columnas:
   - Panel izquierdo: lista de libretas + buscador + filtros por etiqueta
   - Panel derecho: lista de notas de la libreta seleccionada o vista de edicion

2. **`NoteEditor.tsx`** - Editor de notas con:
   - Titulo editable inline
   - Area de contenido con `contentEditable` o `textarea` enriquecida
   - Soporte para pegar imagenes (evento `paste` -> subir a Storage -> insertar URL)
   - Fecha de creacion mostrada automaticamente
   - Selector de etiquetas (reutiliza `TagSelector` adaptado)

3. **`NotebookList.tsx`** - Lista lateral de libretas con:
   - Crear nueva libreta (nombre + color)
   - Contador de notas por libreta
   - "Todas las notas" como opcion por defecto

### Hook nuevo

- **`useNotes.tsx`** - CRUD para notebooks, notes, note_tags. Queries con React Query. Busqueda por titulo/contenido. Filtro por libreta y etiquetas.

### Flujo de imagenes (Ctrl+V)

- En el editor, capturar evento `onPaste`.
- Si el clipboard contiene imagen (`clipboardData.files`), subirla a `note-images/{user_id}/{uuid}.png` via Supabase Storage.
- Obtener URL publica e insertarla como `<img>` en el contenido.
- El contenido se guarda como HTML en la columna `content`.

### Archivos a crear/modificar

| Accion   | Archivo |
|----------|---------|
| Crear    | Migracion SQL (notebooks, notes, note_tags, bucket, RLS) |
| Crear    | `src/hooks/useNotes.tsx` |
| Crear    | `src/components/NotesView.tsx` |
| Crear    | `src/components/NoteEditor.tsx` |
| Crear    | `src/components/NotebookList.tsx` |
| Modificar | `src/components/AppSidebar.tsx` (agregar filtro "Notas") |
| Modificar | `src/pages/Index.tsx` (renderizar NotesView cuando filter='notas') |

