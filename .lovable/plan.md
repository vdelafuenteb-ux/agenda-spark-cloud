

## Plan: Corregir datos vacíos después de login

### Problema
Los hooks de datos (`useTopics`, `useTags`, `useAssignees`, etc.) ejecutan sus queries inmediatamente al montar el componente, antes de que la sesión de autenticación esté lista. Como el `staleTime` es de 5 minutos, los resultados vacíos (bloqueados por RLS) se cachean y no se vuelven a pedir después del login.

### Solución
Agregar un `useEffect` en `Index.tsx` que invalide todas las queries de React Query cuando el `user` cambie de `null` a un valor válido (es decir, después del login exitoso).

### Cambio en `src/pages/Index.tsx`

Agregar después de la línea 34 (`const { user, loading: authLoading } = useAuth();`):

```typescript
useEffect(() => {
  if (user) {
    queryClient.invalidateQueries();
  }
}, [user, queryClient]);
```

Esto forzará que todas las queries se vuelvan a ejecutar con la sesión autenticada después del login.

### Archivo a modificar
- `src/pages/Index.tsx` (agregar 1 import + 1 useEffect)

