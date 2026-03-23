

## Plan: Sistema de Carga de Trabajo por Responsable

### Resumen
Agregar campos de Horas Hombre (HH) a cada tema y crear una vista de "Equipo" en el sidebar que muestre un resumen de carga de trabajo por responsable, incluyendo % de capacidad utilizada.

### Cambios

**1. Base de datos: Agregar campos HH a la tabla `topics`**
- Migración SQL con 3 columnas nuevas:
  - `hh_type` (text, nullable): `'diaria'`, `'semanal'`, o `'total'`
  - `hh_value` (numeric, nullable): cantidad de horas asignadas
- También agregar a la tabla `assignees`:
  - `weekly_capacity` (numeric, default 45): horas semanales disponibles del trabajador

**2. UI en TopicCard y CreateTopicModal: Campo de HH**
- Agregar un input numérico de "HH" con un selector de tipo (Diaria/Semanal/Total) en:
  - `CreateTopicModal.tsx`: nuevo campo en el formulario de creación
  - `TopicCard.tsx`: campo editable en la vista expandida
- Se muestra como badge compacto en la vista colapsada (ej: "4h/sem")

**3. Nueva vista "Equipo" en el sidebar**
- Agregar filtro `'equipo'` al tipo `Filter` en `types/filters.ts`
- Agregar entrada "Equipo" con icono `Users` en `AppSidebar.tsx`
- Crear componente `TeamView.tsx` que muestre:
  - Tarjetas por responsable con:
    - HH semanales asignadas (normalizando diarias x5, totales prorrateadas)
    - Capacidad semanal configurada
    - Barra de progreso de % carga (verde <70%, amarillo 70-90%, rojo >90%)
    - Cantidad de temas activos/seguimiento
  - Vista resumen tipo ranking con barras de carga
  - Click en responsable abre `AssigneeProfileView` existente
- En `SettingsView.tsx` (sección responsables): agregar campo editable de "Capacidad semanal (hrs)" por responsable

**4. Conectar en Index.tsx**
- Renderizar `TeamView` cuando `filter === 'equipo'`
- Pasar topics y assignees como props

### Lógica de normalización de HH
- Diaria → semanal: valor x 5
- Semanal → tal cual
- Total → se divide entre semanas restantes hasta due_date (o se muestra como "total" sin normalizar si no hay fecha)

### Archivos a modificar
- `supabase/migrations/` — nueva migración (3 columnas)
- `src/types/filters.ts` — agregar `'equipo'`
- `src/components/AppSidebar.tsx` — nueva entrada sidebar
- `src/components/CreateTopicModal.tsx` — campos HH
- `src/components/TopicCard.tsx` — campos HH editables + badge
- `src/components/SettingsView.tsx` — capacidad semanal por responsable
- `src/pages/Index.tsx` — renderizar TeamView
- **Nuevo:** `src/components/TeamView.tsx` — vista principal de equipo

