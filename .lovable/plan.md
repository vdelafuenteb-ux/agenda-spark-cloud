

## Plan: Abrir TopicCard completa desde la pestaña "Temas" del perfil del responsable

### Problema
Actualmente, al hacer click en un tema en la pestaña "Temas" del perfil, se usa `onNavigateToTopic` que redirige a la vista principal. El usuario quiere poder abrir el tema completo (con todas las opciones de edición) directamente desde el perfil, sin salir de él.

### Cambio

**En `src/components/AssigneeProfileView.tsx`:**

1. **Agregar props necesarias** para pasar las mismas callbacks de edición que usa `TopicCard` en Index.tsx (mutations de subtasks, progress entries, attachments, tags, etc.)

2. **Estado local `selectedTopicId`** para rastrear qué tema está abierto

3. **Agregar un ícono/botón "Abrir tema"** (ExternalLink o Eye) en cada fila de la tabla de temas, que al hacer click abre un `Dialog` con el `TopicCard` completo dentro

4. **Dialog con TopicCard**: Renderizar un `Dialog` fullscreen o grande que contenga el `<TopicCard>` con todas las props de edición (las mismas que en Index.tsx), permitiendo modificar todo como si estuviera en la vista principal

### Props nuevas en AssigneeProfileView

```typescript
interface AssigneeProfileViewProps {
  // ... existentes ...
  // Nuevas para edición completa:
  allTags?: Tag[];
  topicTags?: (topicId: string) => Tag[];
  userId?: string;
  onUpdate?: (id: string, data: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  onAddSubtask?: (topicId: string, title: string) => void;
  onToggleSubtask?: (id: string, completed: boolean) => void;
  onUpdateSubtask?: (id: string, data: Record<string, unknown>) => void;
  onDeleteSubtask?: (id: string) => void;
  // ... todas las demás callbacks de TopicCard ...
}
```

### Flujo
1. En la tabla de temas, agregar columna con botón "Abrir" (ícono ojo o expand)
2. Click → `setSelectedTopicId(topic.id)` → abre Dialog
3. Dialog contiene `<TopicCard>` con `forceExpand={true}` y todas las props de mutación
4. Al cerrar el dialog → `setSelectedTopicId(null)`

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Agregar props de edición, estado selectedTopicId, Dialog con TopicCard |
| `src/pages/Index.tsx` | Pasar las props de edición adicionales a AssigneeProfileView |
| `src/components/DashboardView.tsx` | Pasar las mismas props adicionales si también usa AssigneeProfileView |
| `src/components/TeamView.tsx` | Pasar las mismas props adicionales si también usa AssigneeProfileView |

