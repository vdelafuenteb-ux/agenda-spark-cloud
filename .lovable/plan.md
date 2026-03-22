

## Plan: Corregir error al expandir temas

### Problema
El error ocurre porque en `TopicCard.tsx` línea 488, hay un `<SelectItem value="">` para "Sin departamento". Radix UI Select no permite valores vacíos (`""`) — esto causa un crash en runtime.

### Solución
Cambiar el valor vacío por un placeholder como `"none"` y manejar la conversión:

**Archivo:** `src/components/TopicCard.tsx`, líneas 482-493

```tsx
<Select
  value={(topic as any).department_id || 'none'}
  onValueChange={(value) => onUpdate(topic.id, { department_id: value === 'none' ? null : value })}
>
  <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Sin departamento" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="none">Sin departamento</SelectItem>
    {departments.map((d) => (
      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Cambio único
- `src/components/TopicCard.tsx` — reemplazar `value=""` por `value="none"` y ajustar el handler

