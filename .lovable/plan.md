

## Plan: Corregir lógica del resumen diario para excluir tareas completadas

### Problema
La función `send-daily-summary` muestra subtareas ya completadas (como "Cierre Stand", completada el 25 mar) en la sección "Hoy" porque usa `includeCompleted: true` al construir los ítems de hoy. Esto filtra por `due_date == today` sin importar si ya está terminada.

### Solución
En `supabase/functions/send-daily-summary/index.ts`:

1. **Cambiar `todayItems`** de `includeCompleted: true` a `includeCompleted: false` — las tareas completadas no deben aparecer como pendientes
2. **Igualmente para checklist**: ya filtra `completed: false` en la query, así que está bien
3. **Para temas (topics)**: agregar filtro en `buildItems` para que también excluya temas con `status: 'completado'` o `status: 'pausado'` cuando no se quieren completados

Cambio principal — una sola línea:
```typescript
// ANTES
const todayItems = buildItems(topics, (d) => isToday(d, today), true);

// DESPUÉS  
const todayItems = buildItems(topics, (d) => isToday(d, today), false);
```

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `supabase/functions/send-daily-summary/index.ts` | Cambiar `includeCompleted` de `true` a `false` en la construcción de `todayItems` |

