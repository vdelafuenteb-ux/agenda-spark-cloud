

## Plan: Responsable como dropdown con buscador + formulario de creación rápida

### Cambios en `src/components/CreateTopicModal.tsx`

**1. Mover "Responsable" justo debajo del Título** (antes de Orden/Prioridad/Estado/Departamento)

**2. Reemplazar los botones de responsables** por un dropdown con buscador usando `Popover` + `Command` (igual que los filtros del FilterBar):
- Input que muestra el nombre seleccionado o placeholder "Seleccionar responsable..."
- Lista buscable con lupa
- Al seleccionar, auto-completa departamento como ya funciona

**3. Agregar opción "Crear nuevo responsable"** al final del dropdown:
- Al hacer clic, abre un mini-formulario inline (dentro del modal) con 3 campos: Nombre, Email, Departamento (Select)
- Al confirmar, llama a `onCreateAssignee` con el nombre, y luego actualiza el assignee con email y departamento
- Requiere ampliar `onCreateAssignee` para aceptar `{ name, email?, department_id? }` en vez de solo `string`

**4. Actualizar el hook y la prop:**
- `onCreateAssignee` pasa de `(name: string) => Promise<Assignee>` a `(data: { name: string; email?: string; department_id?: string }) => Promise<Assignee>`
- En `useAssignees.tsx`, el mutation `createAssignee` inserta con `{ name, email, department_id }` 
- En `src/pages/Index.tsx`, actualizar las llamadas a `createAssignee.mutateAsync`

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/CreateTopicModal.tsx` | Mover responsable arriba, dropdown con buscador, mini-form de creación |
| `src/hooks/useAssignees.tsx` | `createAssignee` acepta `{ name, email?, department_id? }` |
| `src/pages/Index.tsx` | Actualizar llamadas a `createAssignee.mutateAsync` |

