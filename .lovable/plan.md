

## Plan: Revisión, limpieza y optimización del código

### Problemas encontrados

**1. Casts `as any` innecesarios (seguridad de tipos)**
Los tipos generados ya incluyen `is_ongoing`, `department_id`, `pause_reason`, `paused_at` en topics y `contact`, `responsible` en subtasks. Hay ~30 casts innecesarios que ocultan errores potenciales.

**2. Bug pendiente: fondo celeste en ReviewView**
El usuario pidió quitar el fondo celeste de seguimiento, pero `ReviewView` línea 196 aún tiene `bg-cyan-500/5 border-cyan-500/20` para items de seguimiento.

**3. Hook `useDepartments` usa `as any` innecesariamente**
La tabla `departments` existe en los tipos generados. Los casts `as any` en las operaciones de Supabase se pueden eliminar.

**4. Tipo `Filter` duplicado**
`type Filter` está definido idénticamente en `Index.tsx` (línea 30) y `AppSidebar.tsx` (línea 18). Debería estar en un solo lugar.

**5. Parámetro `data: any` en props**
`TopicCard.onUpdate` y `SubtaskRow.onUpdateSubtask` usan `data: any`. Se puede tipar mejor.

**6. Import no usado en `TopicCard.tsx`**
`statusLabels` (línea 59-64) ya no se usa desde que se quitó el badge de status.

### Cambios por archivo

#### `src/components/ReviewView.tsx`
- Quitar `bg-cyan-500/5 border-cyan-500/20` del estilo de items seguimiento (línea 196)
- Cambiar a mismo estilo que items normales: `bg-background border-border`

#### `src/components/TopicCard.tsx`
- Quitar todos los `(topic as any).` — usar `topic.` directamente ya que los tipos lo soportan
- Eliminar `statusLabels` (no se usa)
- Tipar mejor `onUpdate: (id: string, data: Partial<TopicUpdate>) => void`

#### `src/components/SubtaskRow.tsx`
- Quitar `(subtask as any).contact` → `subtask.contact`
- Quitar `(subtask as any).responsible` → `subtask.responsible`

#### `src/hooks/useDepartments.tsx`
- Quitar todos los casts `as any` en operaciones de Supabase
- Usar el tipo generado directamente en vez de interfaz manual

#### `src/types/filters.ts` (nuevo)
- Extraer `type Filter` y `type StatusTab` para reutilizar en Index y AppSidebar

#### `src/pages/Index.tsx`
- Importar `Filter` del nuevo archivo de tipos
- Tipar `handleCreateTopic` sin `as any` para `department_id`

#### `src/hooks/useNotificationEmails.tsx`
- Quitar casts `as any` en insert/update (los tipos ya coinciden)

### Lo que NO se toca (funciona bien)
- `useTopics.tsx` — bien estructurado con optimistic updates
- `useChecklist.tsx` — buen patrón de optimistic updates
- `useAuth.tsx` — limpio
- `ProgressLog.tsx` — bien organizado
- `FilterBar.tsx` — limpio
- `TagSelector.tsx` — limpio
- `NotificationSection.tsx` — funcional
- `BulkEmailModal.tsx` — correcto
- `generateReportPdf.ts` — los `as any` en jsPDF son necesarios (librería sin tipos completos)
- Edge functions — correctas, con auth validada
- RLS policies — todas las tablas tienen RLS correctas con `auth.uid()` checks
- `lib/date.ts` y `lib/reminderMatch.ts` — lógica sólida

### Resumen: 6 archivos modificados, 1 nuevo. Sin cambios funcionales, solo limpieza de tipos y eliminación del fondo celeste pendiente.

