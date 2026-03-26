

## Plan: Rediseñar vista Equipo como ranking en lista con KPIs de interés

### Resumen
Transformar la vista de Equipo de tarjetas (grid 2 columnas) a una **lista vertical tipo ranking**, ordenada por score de productividad (mayor a menor). Cada fila muestra el puesto (#1, #2...), nombre, score, y **KPIs de interés** como "Mejor cerrador", "Más rápido", "Mejor en respuesta de correos", etc.

### Cambios en `src/components/TeamView.tsx`

**1. Calcular score de productividad por responsable (misma lógica del perfil)**
- Reutilizar la lógica de cálculo de las 5 dimensiones (cierre a tiempo, puntualidad subtareas, correos, velocidad, plazos) directamente en TeamView
- Necesita acceso a `notification_emails` — agregar query con `useQuery` agrupando por assignee
- Ordenar por score descendente en vez de por carga

**2. Cambiar layout de grid de tarjetas a lista vertical**
- Reemplazar `grid md:grid-cols-2` por una lista vertical `space-y-2`
- Cada fila: posición (#1, #2), nombre, score circular pequeño, barra de progreso, badges de KPIs destacados
- Fila clickeable para ir al perfil

**3. Agregar KPIs de interés / distinciones**
- Calcular y asignar badges como:
  - "Mejor cerrador" — mayor closureComplianceRate
  - "Más rápido" — menor avgPctUsed (velocidad)
  - "Mejor respuesta" — mayor complianceRate de correos
  - "Más productivo" — mayor score general
  - "Más temas" — mayor cantidad de temas activos
- Mostrar badges solo al #1 de cada categoría

**4. Mantener KPIs globales arriba**
- Conservar las 4 tarjetas KPI superiores (Equipo, HH Semanal, Carga Global, Sobrecargados)
- Cambiar título sección de "Carga por Responsable" a "Ranking de Equipo"

### Detalle técnico

| Elemento | Implementación |
|---|---|
| Score por responsable | Calcular con misma fórmula de 5 dimensiones del perfil, usando topics + emails |
| Datos de emails | `useQuery` a `notification_emails` agrupado por `assignee_name` |
| Layout lista | Filas con flex: `#rank`, avatar/nombre, mini score circle (40px), stats inline, badges |
| Distinciones | Comparar métricas entre assignees, asignar badge al top 1 de cada categoría |
| Orden | Por `productivityScore` desc, luego por nombre |

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/TeamView.tsx` | Rediseño completo: lista ranking + cálculo score + KPIs + badges de distinción |

