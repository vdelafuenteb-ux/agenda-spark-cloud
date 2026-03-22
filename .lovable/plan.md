

## Plan: Mostrar última actividad de bitácora en subtareas

### Qué se hará
En cada fila de subtarea, mostrar de forma sutil la fecha de la última entrada de bitácora y hace cuántos días fue. Si pasaron más de 5 días, se muestra en rojo como alerta visual.

### Cambios en `src/components/SubtaskRow.tsx`

**Calcular última actividad:**
- Tomar el `created_at` de la última entrada en `subtask_entries`
- Calcular días transcurridos con `differenceInDays(new Date(), lastDate)`
- Formatear como `"20 mar (hace 2d)"` o `"17 mar (hace 5d)"` en rojo si >5 días

**Ubicación en la fila:**
- Colocar justo antes del ícono de fecha de vencimiento, como texto pequeño (`text-[10px]`) en `text-muted-foreground`
- Si >5 días: `text-destructive` para que resalte sin sobrecargar
- Solo se muestra si hay al menos una entrada de bitácora

**Ejemplo visual:**
```text
☐ Despegar [Atrasada]          últ: 17 mar (5d) 👁1  📅 17 mar  🗑
☐ Aeromexico                                     👁   📅 Sin fecha
☐ Atlas                        últ: 21 mar (1d)  👁   📅 Sin fecha
```

### Archivo a modificar
- `src/components/SubtaskRow.tsx` — agregar cálculo de última entrada y renderizado sutil

