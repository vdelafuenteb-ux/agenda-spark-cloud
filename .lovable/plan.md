

## Plan: Bitácora de Avances + Gestión de Estados de Temas

### 1. Nueva tabla `progress_entries` (Bitácora)

Reemplazar el campo de texto `progress_notes` por una tabla de entradas tipo chat/bitácora:

- **progress_entries**: `id`, `topic_id` (FK→topics), `content` (text), `created_at`
- RLS: acceso vía join con `topics.user_id = auth.uid()`
- Se mantiene el campo `progress_notes` en topics pero se deja de usar (no breaking change)

### 2. UI de Bitácora en TopicCard

Reemplazar el `<Textarea>` de "Notas de avance" por un componente tipo chat:
- Lista de mensajes con timestamp (`hace 2h`, `17 Mar 14:30`)
- Input + botón "Enviar" al fondo para agregar nueva entrada
- Si hay más de 4-5 mensajes, mostrar un área con scroll (max-height ~200px) con scroll automático al último mensaje
- Cada entrada muestra el texto y la fecha, estilo burbuja minimalista

### 3. Botón "Cerrar Tema" y gestión de estados

Agregar en la zona expandida del TopicCard:
- Botón visible **"Marcar como Completado"** (o "Reabrir" si ya está completado)
- El selector de estado ya existe pero no es suficientemente visible — se mantiene pero se complementa con un botón de acción directa

### 4. Sub-pestañas de estado en la vista principal

Reemplazar el filtro actual "Todos" por **3 sub-pestañas** debajo del header:
- **Activos** (default) — `status = 'activo'`
- **Pausados** — `status = 'pausado'`  
- **Cerrados** — `status = 'completado'`

Usar el componente `Tabs` de shadcn. Los filtros del sidebar (Hoy, Prioridad Alta) se aplican sobre la pestaña activa.

### 5. Hook useTopics

- Agregar mutations para `addProgressEntry` y query para cargar entries junto con topics
- Modificar la query principal para hacer join con `progress_entries`

### Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| Migration SQL | Crear tabla `progress_entries` con RLS |
| `src/hooks/useTopics.tsx` | Agregar query de entries + mutation `addProgressEntry` |
| `src/components/TopicCard.tsx` | Reemplazar textarea por bitácora; agregar botón cerrar tema |
| `src/pages/Index.tsx` | Agregar Tabs (Activos/Pausados/Cerrados) en lugar de mostrar todo junto |
| `src/components/AppSidebar.tsx` | Quitar "Todos" del sidebar (ahora son las tabs), mantener Hoy/Alta/Informes |

