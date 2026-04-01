

## Plan: Mostrar fecha del próximo recordatorio en temas archivados

### Cambio

En el header de la tarjeta (zona donde aparece "∞ Continuo" o la fecha), cuando el tema está archivado, mostrar la fecha del próximo recordatorio pendiente. Ejemplo: `🔔 Recordatorio: 29 jun`.

### Implementación

**Archivo: `src/components/TopicCard.tsx`**

1. Importar `useTopicReminders` en TopicCard
2. Llamar al hook: `const { reminders } = useTopicReminders(topic.id)`
3. Calcular el próximo recordatorio pendiente: filtrar `reminders` donde `sent === false`, ordenar por fecha, tomar el primero
4. En la zona del header (después del badge "Continuo" o la fecha, ~línea 298), agregar una condición: si `(topic as any).archived && nextReminder`, mostrar un badge con ícono de campana y la fecha formateada
5. Solo se muestra en temas archivados, no en los activos normales (ahí ya se ve la sección completa de recordatorios al expandir)

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/TopicCard.tsx` | Importar hook, calcular próximo recordatorio, renderizar badge en header solo para archivados |

