

## Plan: Temas atrasados aparecen primero por defecto

### Cambio

En `src/pages/Index.tsx`, en la función de ordenamiento (línea ~124), **antes** de aplicar el criterio de sort seleccionado pero **después** del pinned, agregar una comparación que ponga los temas atrasados (con `due_date` pasada, no completados, no ongoing) primero.

### Lógica

```typescript
// Después de pinDiff, antes del sortBy:
const aOverdue = a.due_date && !a.is_ongoing && a.status !== 'completado' && isStoredDateOverdue(a.due_date) ? 1 : 0;
const bOverdue = b.due_date && !b.is_ongoing && b.status !== 'completado' && isStoredDateOverdue(b.due_date) ? 1 : 0;
if (aOverdue !== bOverdue) return bOverdue - aOverdue; // atrasados primero
```

Importar `isStoredDateOverdue` de `@/lib/date` (ya se usa en otros componentes).

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/pages/Index.tsx` | Importar `isStoredDateOverdue`, agregar priorización de atrasados en sort |

