

## Plan: Dashboard de Analítica

### Qué se hará

Agregar una nueva sección "Dashboard" en el sidebar que muestre un panel completo de estadísticas y tendencias sobre todos los temas, subtareas y progreso.

### Cambios

**1. `src/components/AppSidebar.tsx`**
- Agregar filtro `'dashboard'` con icono `BarChart3`.
- Actualizar el tipo `Filter`.

**2. `src/pages/Index.tsx`**
- Actualizar tipo `Filter` para incluir `'dashboard'`.
- Renderizar `<DashboardView />` cuando `filter === 'dashboard'`.

**3. Nuevo: `src/components/DashboardView.tsx`**
- Recibe `topics: TopicWithSubtasks[]` como prop.
- Calcula todas las métricas a partir de los datos existentes (sin queries adicionales).

**Tarjetas de resumen (KPIs):**
- Temas activos / En seguimiento / Pausados / Completados
- Subtareas totales vs completadas (con %)
- Temas atrasados (due_date pasada)
- Temas por vencer (próximos 3 días)

**Gráficos (usando Recharts, ya instalado vía `chart.tsx`):**
- **Gráfico de barras**: Temas por estado (activo/seguimiento/pausado/completado).
- **Gráfico de línea/área**: Tendencia de temas completados por semana (últimas 8 semanas, basado en `updated_at` de temas con status completado).
- **Gráfico de pie/donut**: Distribución por prioridad (alta/media/baja).
- **Tabla ranking**: Top responsables con cantidad de temas asignados y % completado de subtareas.

**Diseño visual:**
- Grid responsive: 4 KPI cards arriba, gráficos en 2 columnas debajo, tabla de responsables al final.
- Usa los componentes `Card`, `ChartContainer`, `ChartTooltip` ya existentes.

