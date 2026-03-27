

## Plan: Corregir actualización del calendario al marcar recordatorios

### Problema
Al hacer click en un recordatorio (ej: "Cobrar API") para marcarlo como completado, el calendario no se actualiza visualmente. El punto sigue apareciendo rojo en vez de verde.

### Causa raíz
En `CalendarView.tsx`, el `useMemo` de `eventsByDay` (línea 112) no incluye `isCompleted` en su array de dependencias:

```typescript
}, [calendarDays, reminders, activeTopics, holidayMap, showPeriodicEvents]);
//  ^ falta isCompleted
```

Cuando `toggleCompletion` se ejecuta y se recargan las completions, `isCompleted` cambia pero el memo no se recalcula → los colores de los dots no se actualizan.

### Solución
Agregar `isCompleted` al array de dependencias del `useMemo`:

```typescript
}, [calendarDays, reminders, activeTopics, holidayMap, showPeriodicEvents, isCompleted]);
```

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/CalendarView.tsx` | Agregar `isCompleted` a dependencias del `useMemo` de `eventsByDay` |

