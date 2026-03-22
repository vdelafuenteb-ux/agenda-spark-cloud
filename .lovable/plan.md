

## Plan: Corregir ancho columna "Estado" en PDF + Auto-completar subtareas al cerrar tema

### Problema 1: "Completado" se corta en 2 líneas en el PDF
La columna "Estado" tiene `cellWidth: 16` que es muy estrecho para la palabra "Completado".

**Cambio en `src/lib/generateReportPdf.ts`**:
- Aumentar `columnStyles[3]` (Estado) de `cellWidth: 16` a `cellWidth: 20`
- Reducir otra columna para compensar (ej: "Prioridad" col 2 de 16 a 14, "Responsable" col 1 de 24 a 22)

### Problema 2: Al cerrar un tema, las subtareas quedan pendientes
Cuando se presiona "Cerrar" en un tema, solo se actualiza el status del tema pero no se marcan las subtareas como completadas.

**Cambio en `src/pages/Index.tsx`** (línea ~322):
- Modificar el handler `onUpdate` para que cuando `data.status === 'completado'`, automáticamente marque todas las subtareas pendientes del tema como completadas
- Buscar el tema en `topics`, filtrar subtareas con `completed === false`, y llamar `toggleSubtask.mutate` para cada una

```typescript
onUpdate={(id, data) => {
  updateTopic.mutate({ id, ...data });
  if (data.status === 'completado') {
    const topic = topics.find(t => t.id === id);
    topic?.subtasks.filter(s => !s.completed).forEach(s => {
      toggleSubtask.mutate({ id: s.id, completed: true });
    });
  }
}}
```

### Archivos a modificar
1. **`src/lib/generateReportPdf.ts`** — Ajustar anchos de columna (Estado más ancho)
2. **`src/pages/Index.tsx`** — Agregar lógica de auto-completar subtareas al cerrar tema

