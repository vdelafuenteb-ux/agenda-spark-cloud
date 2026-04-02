

## Plan: Orden de ejecución siempre primero, automáticamente

### Problema

Actualmente el orden de ejecución solo aplica cuando se selecciona manualmente "Orden de ejecución" en el dropdown. Si seleccionas "Prioridad", los temas con P1 pueden quedar debajo de P3 porque ordena solo por nivel (alta/media/baja).

### Solución

Hacer que el orden de ejecución (`execution_order`) **siempre mande** en todos los modos de ordenamiento. Los temas con orden asignado siempre van primero (P1, P2, P3...), y los temas sin orden se ordenan según el criterio seleccionado (prioridad, fecha, etc.).

### Cambio

**Archivo: `src/pages/Index.tsx`** (~líneas 108-131)

Modificar la función de sort para que **antes** de aplicar el criterio seleccionado, siempre agrupe los temas con `execution_order` al inicio:

```
1. Pinned primero
2. Atrasados primero  
3. Temas CON execution_order → ordenados por execution_order (P1, P2, P3...)
4. Temas SIN execution_order → ordenados por el criterio seleccionado (prioridad/fecha/creación)
```

Así, sin importar qué opción de ordenamiento elijas, P1 siempre estará antes que P2, y P2 antes que P3. Los temas sin orden asignado aparecen después, ordenados según tu selección.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/pages/Index.tsx` | Modificar sort para que `execution_order` siempre sea el criterio principal después de pinned/atrasados |

