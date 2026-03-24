

## Archivos adjuntos en la Bitácora de Avances

### Resumen
Agregar soporte para subir archivos (PDF, Word, imágenes, etc.) en las entradas de la bitácora, tanto en temas principales como en subtareas. Los archivos se almacenan en un bucket de storage y se vinculan a cada entrada. Se muestra previsualización para imágenes e iconos para documentos.

### Cambios

**1. Migración SQL -- bucket + tabla + RLS**

- Crear bucket público `progress-attachments`
- Crear tabla `entry_attachments`:
  - `id` uuid PK
  - `entry_id` uuid (referencia a progress_entry o subtask_entry)
  - `entry_type` text (`'progress'` o `'subtask'`)
  - `file_name` text
  - `file_url` text
  - `file_type` text (MIME)
  - `file_size` integer
  - `created_at` timestamptz default now()
- RLS policies que validen que el entry pertenece a un topic del usuario autenticado (join through progress_entries->topics o subtask_entries->subtasks->topics)
- Storage policies: upload/delete scoped a `auth.uid()` folder, select público

**2. `src/hooks/useTopics.tsx`**
- Fetch `entry_attachments` en la query principal y mapearlos a cada `progress_entry` y `subtask_entry`
- Agregar tipos `EntryAttachment` exportado
- Agregar mutaciones: `uploadEntryAttachment(entryId, entryType, file)` y `deleteEntryAttachment(id, fileUrl)`
- Upload usa `supabase.storage.from('progress-attachments').upload(userId/uuid.ext, file)`

**3. `src/components/ProgressLog.tsx`**
- Extender `GenericEntry` con `attachments?: EntryAttachment[]`
- Nuevas props: `onUploadFiles?(entryId: string, files: File[]) => void`, `onDeleteAttachment?(id: string) => void`, `entryType?: 'progress' | 'subtask'`
- En el input area: agregar botón Paperclip que abre `<input type="file" multiple accept="*/*">`
- Mostrar archivos pendientes como chips antes de enviar
- Modificar `handleSend`: primero crea la entrada de texto (necesita devolver el ID), luego sube los archivos
- Cambiar `onAdd` a retornar `Promise<string>` (el id de la entrada creada)
- En cada entrada existente: renderizar lista de attachments debajo del texto
  - Imágenes (image/*): miniatura inline clicable
  - PDFs: icono + nombre, abre en nueva pestaña
  - Otros: icono genérico + nombre, enlace de descarga
  - Botón eliminar al hover

**4. `src/components/TopicCard.tsx`**
- Pasar las nuevas props `onUploadFiles` y `onDeleteAttachment` al `ProgressLog`
- Ajustar `onAddProgressEntry` para que retorne el ID de la entrada creada

**5. `src/components/SubtaskRow.tsx`**
- Pasar las nuevas props al `ProgressLog` de subtareas
- Ajustar `onAddSubtaskEntry` para que retorne el ID

**6. `src/hooks/useTopics.tsx` -- ajustar mutaciones de add**
- `addProgressEntry` y `addSubtaskEntry` deben retornar el `id` de la entrada insertada (`.select().single()`)

**7. `src/pages/Index.tsx`**
- Pasar los nuevos handlers de upload/delete a `TopicCard`

### Flujo del usuario
1. Escribe un avance y opcionalmente adjunta archivos con el botón de clip
2. Ve los archivos seleccionados como chips debajo del textarea
3. Envía -- se crea la entrada y se suben los archivos
4. Los archivos aparecen con previsualización (imágenes inline, PDFs con icono)
5. Puede eliminar archivos individuales al hacer hover

### Archivos a modificar
- 1 migración SQL (tabla + bucket + RLS + storage policies)
- `src/hooks/useTopics.tsx`
- `src/components/ProgressLog.tsx`
- `src/components/TopicCard.tsx`
- `src/components/SubtaskRow.tsx`
- `src/pages/Index.tsx`

