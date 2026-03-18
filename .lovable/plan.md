

## Plan: Envío masivo de correos consolidados por responsable

### Concepto
Cuando estés en la pestaña **Seguimiento** y filtres por un responsable, aparecerá un botón **"Enviar recordatorio masivo"**. Al hacer clic se abre un modal donde:
1. Se listan todos los temas del responsable seleccionado
2. Puedes marcar/desmarcar los que quieras incluir (por defecto todos seleccionados)
3. Al confirmar, se envía **un solo correo** consolidado con todos los temas seleccionados y sus subtareas pendientes

### Cambios técnicos

**1. Nueva Edge Function `send-bulk-notification`** (`supabase/functions/send-bulk-notification/index.ts`)
- Recibe `to_email`, `to_name`, y un array `topics: [{ title, subtasks }]`
- Genera un HTML con todos los temas listados ordenadamente en un solo correo
- Envía CC a matias@ y vicente@ igual que la función individual
- Reutiliza el mismo endpoint de Firebase

**2. Nuevo componente `BulkEmailModal`** (`src/components/BulkEmailModal.tsx`)
- Modal con checkboxes para seleccionar temas
- Botón "Seleccionar todos / Deseleccionar todos"
- Muestra responsable, email, y lista de temas con checkbox
- Botón enviar que llama a la edge function y registra un log por cada tema enviado en `notification_emails`

**3. Modificar `FilterBar.tsx`**
- Cuando hay un `selectedAssignee` (no `_all`), mostrar un botón "Enviar recordatorio masivo" con icono de correo

**4. Modificar `Index.tsx`**
- Agregar estado para abrir el modal de envío masivo
- Pasar los temas filtrados del responsable seleccionado y los datos del assignee al modal

### Flujo del correo consolidado
El correo tendrá este formato:
```
Hola [nombre],

Te escribimos para recordarte sobre las siguientes tareas:

1. [Tema 1]
   - Subtarea pendiente A (vence: fecha)
   - Subtarea pendiente B

2. [Tema 2]
   - Subtarea pendiente C

Por favor actualiza sobre el estado de estas tareas.
Gracias.
```

### Archivos a crear/modificar
- **Crear**: `supabase/functions/send-bulk-notification/index.ts`
- **Crear**: `src/components/BulkEmailModal.tsx`
- **Modificar**: `src/components/FilterBar.tsx` (agregar botón)
- **Modificar**: `src/pages/Index.tsx` (estado del modal, pasar props)

