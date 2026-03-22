

## Plan: Drag & Drop de notas sueltas a libretas/temas desde la vista principal

### Concepto
Rediseñar la vista `notebooks` para mostrar dos zonas:
1. **Arriba**: Libretas en grid con chevron expandible que revela sus temas inline (sin navegar a otra página)
2. **Abajo**: "Notas sin asignar" — notas que no tienen `notebook_id` — como cards arrastrables

El usuario puede arrastrar una nota suelta hacia una libreta (asigna `notebook_id`) o hacia un tema expandido (asigna `notebook_id` + `section_id`). Paginación horizontal o "cargar más" para muchas notas.

### Diseño de la interfaz

```text
┌─────────────────────────────────────────────┐
│ 📚 Libretas                   [+ Nueva]     │
├─────────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│ │ Transit ▶│  │ Personal │  │ Proyecto │   │
│ │ 2t · 3n  │  │ 0t · 1n  │  │ 1t · 0n  │   │
│ └──────────┘  └──────────┘  └──────────┘   │
│                                             │
│ ▼ Transit (expandido)                       │
│   ├─ 📂 Abogados          [drop zone]      │
│   ├─ 📂 Facturas          [drop zone]      │
│   └─ 📂 Sin tema          [drop zone]      │
├─────────────────────────────────────────────┤
│ 📋 Notas sin asignar (3)        [→ ver más] │
│ ┌────────┐ ┌────────┐ ┌────────┐           │
│ │ Nota 1 │ │ Nota 2 │ │ Nota 3 │  draggable│
│ └────────┘ └────────┘ └────────┘           │
└─────────────────────────────────────────────┘
```

### Cambios técnicos

#### 1. `NotebookGrid.tsx` — Rediseño completo
- Agregar prop `onMoveNote: (noteId: string, notebookId: string, sectionId: string | null) => void`
- Cada libreta card tiene un botón chevron (▶/▼) que expande/colapsa sus temas inline
- Libreta expandida muestra sus secciones como filas drop target
- Implementar drag & drop con HTML5 native API (`draggable`, `onDragOver`, `onDrop`)
- Libretas cerradas también son drop targets (asigna solo `notebook_id`)

#### 2. `NotebookGrid.tsx` — Sección "Notas sin asignar"
- Debajo de las libretas, mostrar notas donde `notebook_id === null`
- Cards compactas con `draggable="true"` y `onDragStart` que setea el `noteId`
- Si hay muchas notas (>6), mostrar botón "ver más" o scroll horizontal

#### 3. `NotesView.tsx` — Pasar handler de mover nota
- Crear `handleMoveNote(noteId, notebookId, sectionId)` que llama `updateNote.mutate`
- Pasar como prop a `NotebookGrid`

#### 4. `useNotes.tsx` — Sin cambios
- `updateNote` ya soporta `notebook_id` y `section_id`, no hace falta cambiar nada

### Archivos a modificar
- **`src/components/NotebookGrid.tsx`**: Rediseño con expand/collapse de temas y drag targets + sección de notas sueltas draggables
- **`src/components/NotesView.tsx`**: Agregar handler `onMoveNote` y pasarlo como prop

