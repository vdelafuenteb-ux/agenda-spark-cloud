

## Plan: Mostrar nombres de autor en historial de avances

### Problema
En la página de actualización externa, los mensajes del historial solo muestran "Tú" para los del responsable y nada para los del administrador. No queda claro quién escribió cada mensaje.

### Solución

#### 1. Edge Function `validate-update-token/index.ts`
- Buscar el nombre del dueño de los temas consultando `auth.users` con el `user_id` del token para obtener el email, o mejor: pasar un campo `owner_name` en la respuesta.
- Como no hay tabla de perfiles, usar el email del usuario (`auth.users.email`) como fallback, o hardcodear según la memoria de branding. La opción más limpia: consultar `auth.users` con service role para obtener el email y extraer el nombre antes del `@`, o agregar el nombre del usuario como campo adicional en la respuesta.
- **Mejor enfoque**: Agregar `owner_name` a la respuesta JSON. Consultar `supabase.auth.admin.getUserById(tokenData.user_id)` para obtener el email/metadata del dueño.

#### 2. Página `src/pages/UpdateTopics.tsx`
- Guardar `ownerName` del response en estado.
- En cada entrada del historial, mostrar:
  - Si `source === "assignee"` → nombre del responsable (ya disponible como `assigneeName`)
  - Si no → nombre del dueño (`ownerName`)
- Mostrar el nombre en negrita antes del contenido o en la línea de fecha.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/validate-update-token/index.ts` | Consultar nombre del dueño y agregarlo al JSON de respuesta |
| `src/pages/UpdateTopics.tsx` | Mostrar nombre del autor en cada entrada del historial |

