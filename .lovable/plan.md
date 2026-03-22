

## Plan: Simplificar vista de Revisión a lista plana de items accionables

### Problema actual
La vista de Revisión muestra `TopicCard` completas con todo el detalle (subtareas, bitácora, tags, estado, etc.), repitiendo la misma información que ya está en la lista de temas. Esto hace la vista pesada e innecesaria como herramienta de revisión rápida.

### Solución
Reemplazar las TopicCards por una **lista plana de items individuales** (hitos/subtareas) con filas compactas y accionables. Si lo atrasado es un hito específico, solo se muestra ese hito con referencia al tema padre.

### Nuevo diseño de cada fila

```text
[✓] Nombre del hito/subtarea    → Tema padre    👤 Responsable    Alta    20 mar
```

Cada fila compacta (~40px) muestra:
- **Botón check** para marcar completado directamente
- **Título** del item (subtarea o tema si no tiene subtareas con fecha)
- **Tema padre** como texto secundario pequeño (solo para subtareas)
- **Responsable** del tema
- **Prioridad** como badge pequeño
- **Fecha** de vencimiento

### Cambios en `ReviewView.tsx`

1. **Eliminar importación de TopicCard** y todas sus props/handlers innecesarios
2. **Crear tipo `ReviewItem`** que unifique subtareas, recordatorios y checklist en una sola lista:
   ```typescript
   type ReviewItem = {
     type: 'subtask' | 'topic' | 'reminder' | 'checklist';
     id: string;
     title: string;
     parentTopicTitle?: string;
     assignee?: string;
     priority?: string;
     dueDate?: string;
     completed?: boolean;
     onToggle: () => void;
   };
   ```
3. **Generar lista plana** por pestaña: en "Atrasados", solo las subtareas atrasadas (no el tema entero); en "Mi día", solo las subtareas/temas que vencen hoy
4. **Renderizar filas compactas** en lugar de TopicCards - una fila por item individual
5. **Mantener filtros** de responsable y estado (simplificados, sin botón expandir/contraer que ya no aplica)
6. **Simplificar props** del componente eliminando todos los handlers de CRUD pesado (onAddSubtask, onAddProgressEntry, etc.) - solo se necesita `onToggleSubtask`

### Archivos a modificar
- **`src/components/ReviewView.tsx`**: Rediseño completo del renderizado, reemplazando TopicCards por filas planas

### Lo que se mantiene igual
- Tabs (Mi día, Atrasados, Próximos) con badges de conteo
- Filtros de responsable y estado
- Secciones de recordatorios y checklist (ya son filas compactas)
- Lógica de fechas existente

