

## Plan: Mostrar alerta de atraso en temas no completados con fecha vencida

### Problema
Cuando un tema activo tiene fecha de vencimiento pasada (ej: 20 mar, hoy es 27 mar), la fecha se muestra en gris sin ninguna alerta. Solo los temas **completados** muestran badge de "Xd atraso". No hay indicador visual de cuántos días lleva atrasado un tema abierto.

### Solución

**En `src/components/TopicCard.tsx`:**

1. **Colorear la fecha en rojo** cuando el tema no está completado y `due_date` ya pasó (usar `isStoredDateOverdue`)

2. **Agregar badge de días de atraso** junto a la fecha, similar al que ya existe para temas completados:
   - Calcular días de atraso: `Math.ceil((hoy - dueDate) / 86400000)`
   - Mostrar badge destructive: `"7d atraso"` al lado de la fecha

3. **Cambiar el ícono del calendario a rojo** cuando está atrasado

### Cambio concreto (líneas ~277-295)

Antes de renderizar la fecha en el botón del Popover, detectar si está atrasado:
```tsx
const isOverdue = !isCompleted && isStoredDateOverdue(topic.due_date);
const overdueDays = isOverdue && topic.due_date
  ? Math.ceil((Date.now() - parseStoredDate(topic.due_date)!.getTime()) / 86400000)
  : 0;
```

Aplicar al botón:
- Clase `text-destructive` cuando `isOverdue`
- Fecha en rojo: `text-destructive font-medium` en vez de `text-muted-foreground`
- Badge adicional: `<Badge variant="destructive" className="text-[9px] px-1.5 py-0">{overdueDays}d</Badge>`

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/TopicCard.tsx` | Detectar atraso en temas abiertos, colorear fecha en rojo, mostrar badge con días de atraso |

