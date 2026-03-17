

## Executive Progress Engine — Plan de Implementación

### Visión
Una agenda ejecutiva minimalista donde gestionar temas activos, registrar avances, y generar informes profesionales con un clic.

### Backend (Lovable Cloud / Supabase)

**Tablas:**
- **topics** — id, title, priority (alta/media/baja), status (activo/completado/pausado), due_date, progress_notes (texto de avances), created_at, updated_at, sort_order
- **subtasks** — id, topic_id (FK), title, completed (boolean), completed_at, sort_order
- **reports** — id, title, content (markdown generado), period_start, period_end, created_at

### Pantalla Principal — Lista de Temas Activos

- **Sidebar izquierdo (240px):** Filtros rápidos: "Todos", "Hoy", "Prioridad Alta", "Informes". Resumen rápido: "X temas activos, Y% avance general"
- **Feed central (max 800px):** Lista vertical de temas compactos. Cada fila muestra: título (semibold), barra de progreso (2px basada en subtareas completadas), fecha de cierre en mono, badge de prioridad sutil
- **Al hacer clic en un tema:** Se expande con animación (framer-motion) mostrando:
  - Checklist de subtareas (marcar/desmarcar con line-through)
  - Campo de notas/avances (edición in-place, auto-save)
  - Fecha de cierre editable
  - Selector de prioridad
  - Botón para agregar subtareas

### Funcionalidad de Informes

- Botón "Emitir Informe" en header superior derecho
- Modal con selector de período (esta semana / este mes / personalizado)
- Genera automáticamente un resumen ejecutivo con:
  - Resumen general (temas activos, completados, % avance)
  - Detalle por tema: subtareas completadas, avances registrados, estado actual
- Vista previa en markdown renderizado, con opción de copiar o imprimir

### Diseño
- Estética ejecutiva minimalista: Geist Sans, tonos zinc/slate, sin colores brillantes
- Cards sin bordes, separadas por sombras sutiles
- Edición siempre in-place, sin modales de edición
- Auto-guardado en la nube con Lovable Cloud

### CRUD Básico
- Crear, editar y eliminar temas desde la interfaz
- Agregar, completar y eliminar subtareas
- Todo con persistencia en Supabase en tiempo real

