

## Plan: Vista Calendario con Recordatorios Periódicos

### Concepto

Una nueva sección **"Calendario"** en el sidebar que combina dos cosas:
1. **Recordatorios periódicos** — tareas recurrentes configurables (ej: "Pagar cuenta X" cada día 29, "Reunión equipo" cada lunes).
2. **Vista calendario** — muestra en un calendario mensual tanto los recordatorios como eventos de temas existentes (fechas límite, subtareas completadas).

### Cambios en base de datos

**Nueva tabla `reminders`:**
- `id` uuid PK default `gen_random_uuid()`
- `user_id` uuid NOT NULL
- `title` text NOT NULL
- `recurrence_type` text NOT NULL — valores: `'monthly'`, `'weekly'`
- `recurrence_day` integer NOT NULL — día del mes (1-31) para monthly, día de la semana (0-6, 0=domingo) para weekly
- `color` text DEFAULT `'#3b82f6'`
- `created_at` timestamptz DEFAULT `now()`
- RLS: cada usuario solo CRUD los suyos.

### Cambios en UI

**1. Sidebar + Index**
- Agregar filtro `'calendario'` con icono `CalendarDays`, entre Checklist y Notas.
- Renderizar `<CalendarView />`.

**2. Nuevo: `src/hooks/useReminders.tsx`**
- Hook con React Query para CRUD de `reminders`.
- Mutations: crear, eliminar, actualizar recordatorio.

**3. Nuevo: `src/components/CalendarView.tsx`**
- **Calendario mensual** renderizado con celdas por día (grid simple, no DayPicker completo).
- Cada celda muestra:
  - Puntos de color por recordatorios que aplican ese día (ej: si es día 29 y hay un reminder monthly con `recurrence_day=29`).
  - Indicadores de temas con `due_date` en ese día.
  - Indicadores de subtareas completadas en ese día (`completed_at`).
- Al hacer click en un día, se abre un panel lateral o popover mostrando los detalles de ese día.
- Navegación mes anterior/siguiente.

**4. Nuevo: `src/components/ReminderManager.tsx`**
- Panel dentro de CalendarView (o modal) para gestionar recordatorios.
- Formulario simple: título, tipo (semanal/mensual), día, color.
- Lista de recordatorios existentes con opción de eliminar.

### Resumen de archivos

| Archivo | Acción |
|---|---|
| `supabase/migrations/...` | Crear tabla `reminders` con RLS |
| `src/hooks/useReminders.tsx` | Nuevo hook CRUD |
| `src/components/CalendarView.tsx` | Nueva vista calendario |
| `src/components/ReminderManager.tsx` | Gestión de recordatorios |
| `src/components/AppSidebar.tsx` | Agregar filtro `'calendario'` |
| `src/pages/Index.tsx` | Agregar tipo + renderizar CalendarView |

