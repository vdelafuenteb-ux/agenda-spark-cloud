

## Plan: Auditoría y sincronización completa de datos entre todas las vistas

### Problemas encontrados

**1. Cachés de correos fragmentadas (causa principal de desincronización de scores)**
Cada vista usa una query key diferente para los mismos datos de `notification_emails`:
- Dashboard: `notification_emails_all_dashboard`
- TeamView: `notification_emails_team`
- AssigneeProfile: `notification_emails_assignee`
- EmailHistory: `notification_emails_all`
- useNotificationEmails: `notification_emails`

Cuando se confirma/responde un correo en una vista, las otras NO se refrescan. Esto causa que los scores difieran entre vistas.

**2. Departamentos inconsistentes en Index.tsx**
`assigneeDeptMap` en Index.tsx usa `assignees.department_id` (que es `null` para todos), como fallback para filtrar por departamento. Debería usar solo `topics.department_id`.

**3. Cambio de responsable desaparece el tema**
Si hay filtro de responsable activo, al cambiar el responsable de un tema, la actualización optimista hace que el tema deje de cumplir el filtro y desaparezca instantáneamente.

### Solución

#### A) Unificar cache de notification_emails (3 archivos)

**`src/hooks/useNotificationEmails.tsx`**: Agregar invalidación de TODAS las query keys de correos:
```typescript
const invalidateAll = () => {
  queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
  queryClient.invalidateQueries({ queryKey: ['notification_emails_all'] });
  queryClient.invalidateQueries({ queryKey: ['notification_emails_all_dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['notification_emails_team'] });
  queryClient.invalidateQueries({ queryKey: ['notification_emails_assignee'] });
};
```

**`src/components/EmailHistoryView.tsx`**: Agregar las mismas invalidaciones en su `invalidateAll` local.

**`src/components/NotificationSection.tsx`**: Asegurar que al confirmar/enviar correo invalide todas las keys.

#### B) Corregir filtro de departamento en Index.tsx

**`src/pages/Index.tsx`**: Eliminar `assigneeDeptMap` y usar solo `topics.department_id` para:
- `uniqueDepartments`: derivar de `topics.department_id`
- `filteredTopics`: filtrar por `topic.department_id` directamente

```typescript
const uniqueDepartments = useMemo(() => {
  const deptIds = new Set(topics.filter(t => t.status === statusTab && t.department_id).map(t => t.department_id!));
  return departments.filter(d => deptIds.has(d.id)).map(d => d.name).sort();
}, [topics, statusTab, departments]);

// En filteredTopics:
if (selectedDepartment) {
  const dept = departments.find(d => d.name === selectedDepartment);
  if (!dept || topic.department_id !== dept.id) return false;
}
```

#### C) Corregir cambio de responsable con filtro activo

**`src/pages/Index.tsx`**: En el handler de update de tema, si se cambia el `assignee` y hay filtro activo que ya no aplica, limpiar el filtro automáticamente:

```typescript
const handleUpdateTopic = (id: string, data: Record<string, unknown>) => {
  if (data.assignee && selectedAssignee && data.assignee !== selectedAssignee) {
    setSelectedAssignee('');
  }
  updateTopic.mutate({ id, ...data });
};
```

Pasar este handler centralizado a todas las vistas (TopicCard, ReviewView, etc.) en vez del `updateTopic.mutate` directo.

#### D) Invalidaciones cruzadas al enviar correos desde Dashboard/AssigneeProfile

**`src/components/DashboardView.tsx`** y **`src/components/AssigneeProfileView.tsx`**: Después de enviar recordatorio (`send-notification-email`), invalidar todas las query keys de correos para que los scores se actualicen en todas las vistas.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/hooks/useNotificationEmails.tsx` | Invalidar todas las query keys de correos en todas las mutaciones |
| `src/components/EmailHistoryView.tsx` | Invalidar todas las query keys en sus mutaciones |
| `src/components/NotificationSection.tsx` | Invalidar todas las query keys al enviar/confirmar |
| `src/pages/Index.tsx` | Eliminar `assigneeDeptMap`, usar solo `topics.department_id`, crear handler centralizado de update que limpie filtro al cambiar responsable |
| `src/components/DashboardView.tsx` | Invalidar todas las query keys de correos al enviar recordatorio |
| `src/components/AssigneeProfileView.tsx` | Invalidar todas las query keys de correos al enviar recordatorio |

