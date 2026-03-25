

## Plan: Rediseñar tarjetas KPI del Dashboard

### Cambios en `src/components/DashboardView.tsx`

Reemplazar las 4 tarjetas KPI actuales por este nuevo orden y estructura:

1. **Temas Totales** — Valor: activos + seguimiento + pausados. Subtítulo con desglose: `X activos · Y en pausa`  
   (donde "activos" = activo + seguimiento)

2. **Semáforo** — Dos indicadores lado a lado:  
   - **Al Día**: cantidad de temas no atrasados (activos + seguimiento, con fecha, no ongoing, no overdue) — color verde  
   - **Atrasados**: cantidad overdue — color rojo  

3. **Subtareas** — Sin cambios: `completadas/total` con porcentaje

4. **Cerrados** — Sin cambios: total completados

### Detalle técnico

- En `metrics`, calcular `totalActive = activo.length + seguimiento.length + pausado.length` y `onTrack = nonOngoing con fecha y no overdue`
- Tarjeta 1: valor = `totalActive`, subtítulo = `${activo + seguimiento} activos · ${pausado} en pausa`
- Tarjeta 2: renderizado custom con dos columnas (verde/rojo) en vez de un solo número
- Reordenar el array `kpis` acorde

