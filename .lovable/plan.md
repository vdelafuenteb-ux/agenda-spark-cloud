

## Plan: Sub-pestaña "Archivados" en Activos

### Concepto

Agregar un campo `archived` (boolean) a la tabla `topics`. Los temas archivados mantienen su estado `activo` (así los correos programados y recordatorios siguen funcionando), pero se ocultan del tablero principal. Dentro de la pestaña "Activos" aparecen dos sub-pestañas: **En curso** y **Archivados**.

### Cambios

**1. Migración BD**
- `ALTER TABLE topics ADD COLUMN archived boolean NOT NULL DEFAULT false;`

**2. UI en Index.tsx**
- Nuevo estado `archivedTab: 'active' | 'archived'` (default `'active'`)
- Renderizar un toggle group (2 botones pequeños tipo pill) debajo de las Tabs, visible solo cuando `statusTab === 'activo'`
- En `filteredTopics`: cuando `statusTab === 'activo'`, filtrar por `archived === false` (En curso) o `archived === true` (Archivados)
- Actualizar conteo: mostrar cuenta separada en cada sub-pestaña

**3. Botón archivar/desarchivar en TopicCard.tsx**
- Agregar opción rápida (ícono de archivo) en el header de la tarjeta para temas activos
- Click → `updateTopic.mutate({ id, archived: !topic.archived })`
- En la sub-pestaña "Archivados", el botón dice "Restaurar" para volver al tablero

**4. Sin impacto en correos/recordatorios**
- El status sigue siendo `activo`, por lo que `send-topic-reminders`, `send-scheduled-emails` y los KPIs funcionan igual
- Los temas archivados simplemente no aparecen en la vista principal

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Migración BD | Agregar columna `archived` |
| `src/pages/Index.tsx` | Sub-pestañas En curso / Archivados + filtro |
| `src/components/TopicCard.tsx` | Botón archivar/desarchivar |

