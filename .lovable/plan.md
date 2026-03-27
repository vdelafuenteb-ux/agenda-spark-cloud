

## Plan: Mostrar botón de enviar recordatorio en temas activos (no solo seguimiento)

### Cambio

En `src/components/TopicCard.tsx`, línea 892, cambiar la condición de `isSeguimiento` a `isSeguimiento || topic.status === 'activo'` para que la sección de notificaciones (con el botón de enviar recordatorio y el link de actualización) también aparezca en los temas activos.

```typescript
// Antes:
{isSeguimiento && (
  <NotificationSection topic={topic} assignees={assignees} />
)}

// Después:
{(isSeguimiento || topic.status === 'activo') && (
  <NotificationSection topic={topic} assignees={assignees} />
)}
```

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/TopicCard.tsx` | Agregar `topic.status === 'activo'` a la condición de `NotificationSection` |

