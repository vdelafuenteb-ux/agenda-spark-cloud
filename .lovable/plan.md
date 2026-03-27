

## Plan: Asignar departamento a responsables + auto-selección en creación de temas

### Resumen
Agregar un campo `department_id` a la tabla `assignees` para que cada responsable tenga un departamento asignado. Al crear un tema y seleccionar un responsable, el departamento se auto-completa.

### Cambios

**1. Migración: agregar `department_id` a `assignees`**
```sql
ALTER TABLE public.assignees ADD COLUMN department_id uuid DEFAULT NULL;
```

**2. Hook `useAssignees.tsx`**
- Agregar `department_id: string | null` a la interfaz `Assignee`
- Incluir `department_id` en `updateAssignee` mutation

**3. SettingsView — sección Responsables**
- En modo edición de cada responsable, agregar un `Select` de departamento (usando la lista de `departments` que ya recibe como prop)
- En modo vista, mostrar el nombre del departamento junto al nombre/email

**4. CreateTopicModal — auto-selección de departamento**
- Cuando el usuario selecciona un responsable (`setAssignee(a.name)`), buscar su `department_id` en la lista de assignees y hacer `setDepartmentId(a.department_id)` automáticamente
- El usuario puede cambiar el departamento manualmente si quiere

### Detalle técnico

| Archivo | Cambio |
|---|---|
| Nueva migración | `ALTER TABLE assignees ADD COLUMN department_id uuid DEFAULT NULL` |
| `src/hooks/useAssignees.tsx` | Agregar `department_id` a interfaz y a `updateAssignee` |
| `src/components/SettingsView.tsx` | Select de departamento en edición de responsable + mostrar depto en vista |
| `src/components/CreateTopicModal.tsx` | Auto-setear `departmentId` al seleccionar responsable |

