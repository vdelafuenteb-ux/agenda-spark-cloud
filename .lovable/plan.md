

## Plan: Destacar el orden de prioridad en correos y en la vista de temas

### Problema actual

- En los correos (programados del lunes, bulk, individual), los temas se numeran secuencialmente (1, 2, 3...) sin mostrar el `execution_order` real que asignas en la plataforma.
- En la vista de temas del tablero, el número de orden aparece como un círculo pequeño (20px) que no destaca lo suficiente.

### Cambios

**1. Correos programados (`send-scheduled-emails/index.ts`)**
- Ordenar `assigneeTopics` por `execution_order` (los que tienen orden primero, luego el resto)
- Mostrar el `execution_order` como badge destacado antes del título: `🔷 #1 — Nombre del tema` en lugar de un número secuencial
- Si no tiene orden asignado, mostrar sin número

**2. Correo bulk (`send-bulk-notification/index.ts`)**
- Mismo cambio: ordenar topics por `execution_order` y mostrar el badge de prioridad destacado

**3. Correo individual (`send-notification-email/index.ts`)**
- Recibir `execution_order` como campo adicional en el body
- Si existe, mostrarlo destacado en el título del tema

**4. Vista de temas en el tablero (`TopicCard.tsx`)**
- Agrandar el badge de orden: de 20px a 24px, con fondo más llamativo (azul primario más grande)
- Agregar un borde/sombra para que resalte visualmente

### Formato del orden en correos (HTML)

```html
<!-- Con orden asignado -->
<span style="display:inline-block;background:#2563eb;color:#fff;
  border-radius:50%;width:24px;height:24px;text-align:center;
  line-height:24px;font-size:12px;font-weight:700;margin-right:6px;">1</span>
<strong>Nombre del tema</strong>

<!-- Sin orden asignado -->
<strong>• Nombre del tema</strong>
```

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/send-scheduled-emails/index.ts` | Ordenar por `execution_order`, mostrar badge de orden |
| `supabase/functions/send-bulk-notification/index.ts` | Ordenar por `execution_order`, mostrar badge de orden |
| `supabase/functions/send-notification-email/index.ts` | Recibir y mostrar `execution_order` |
| `src/components/TopicCard.tsx` | Agrandar y destacar badge de orden de ejecución |
| `src/components/NotificationSection.tsx` | Pasar `execution_order` al invocar send-notification-email |

