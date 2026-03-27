

## Plan: Reordenar filtros + agregar Departamento + fusionar Continuos/Sin fecha

### Cambios en `FilterBar.tsx`

**1. Nuevo filtro "Departamento"** — dropdown con buscador (Popover + Command), igual que Responsable y Etiquetas.

**2. Fusionar "Continuos" + "Sin fecha fin"** en un solo dropdown llamado "Fecha" con 3 checkboxes:
- ✓ Continuos
- ✓ No continuos  
- ✓ Sin fecha fin

Esto reemplaza el botón separado "Sin fecha fin" y el dropdown "Continuos".

**3. Reordenar los filtros** después del buscador:
1. Responsable
2. Departamento (nuevo)
3. Etiquetas
4. Fecha (fusionado)
5. Expandir/Contraer
6. Orden
7. Correo masivo (condicional)

### Cambios en `Index.tsx`

- Agregar estado `selectedDepartment` (string, nombre del departamento)
- Pasar `departments`, `selectedDepartment`, `onDepartmentChange` al FilterBar
- Agregar filtro en `filteredTopics`: buscar el `department_id` del assignee del topic y comparar con el departamento seleccionado
- Resetear `selectedDepartment` al cambiar de pestaña

### Props nuevas en FilterBar

```typescript
departments?: string[];           // nombres de departamentos
selectedDepartment?: string;
onDepartmentChange?: (dept: string) => void;
```

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/FilterBar.tsx` | Reordenar filtros, agregar Departamento dropdown, fusionar Continuos+Sin fecha en "Fecha" |
| `src/pages/Index.tsx` | Estado `selectedDepartment`, lógica de filtrado por departamento, pasar props al FilterBar |

