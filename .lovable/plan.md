

## Plan: Formato ejecutivo de correo masivo con tabla resumen

### Problema
Cuando se envían muchos temas a un responsable, el correo actual lista cada tema con subtareas, fechas y bitácora expandida, generando un email extremadamente largo e ilegible.

### Solución
Reemplazar el formato actual por una **tabla HTML compacta** con columnas claras, seguida de un detalle colapsado solo cuando hay subtareas pendientes. El correo queda ejecutivo y escaneable.

### Nuevo formato del correo

```text
Hola [Nombre],

Tienes [N] temas pendientes de actualizar. Responde este correo con el estado de cada uno.

┌────┬──────────────────┬────────────┬────────────┬───────────────┐
│ #  │ Tema             │ Inicio     │ Vencimiento│ Pendientes    │
├────┼──────────────────┼────────────┼────────────┼───────────────┤
│ 1  │ Contrato X       │ 01-ene-26  │ 15-mar-26  │ 3 subtareas   │
│ 2  │ Revisión Y       │ —          │ 20-mar-26  │ 1 subtarea    │
│ 3  │ Proyecto Z       │ 10-feb-26  │ —          │ Sin pendientes│
└────┴──────────────────┴────────────┴────────────┴───────────────┘

DETALLE (solo temas con subtareas pendientes):

1. Contrato X
   • Subtarea A (vence: 15-mar)
   • Subtarea B (vence: 20-mar)
   • Subtarea C

⚠️ Responde actualizando CADA tema. Plazo: 48 hrs.
```

### Cambios

**`supabase/functions/send-bulk-notification/index.ts`**:
- Reemplazar el bloque de construcción del HTML (lineas 66-111) con:
  1. Saludo breve + resumen en una linea
  2. Tabla HTML con columnas: #, Tema, Inicio, Vencimiento, Subtareas pendientes
  3. Sección "Detalle" solo para temas que tengan subtareas pendientes (sin bitácora, sin notas de subtareas)
  4. Cierre con instrucciones compactas
- Eliminar la bitácora (progress_entries) del correo masivo para mantenerlo corto
- Mantener el asunto actual que ya es claro

**`supabase/functions/send-notification-email/index.ts`**:
- No cambiar: el correo individual (1 tema) puede mantener el formato detallado actual ya que no tiene el problema de largo

