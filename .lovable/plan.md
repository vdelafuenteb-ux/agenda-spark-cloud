

## Plan: Reestructurar la ficha del responsable — orden por impacto

### Problema
La información está desordenada: las estadísticas de rendimiento (eficiencia de cierre, cumplimiento de correos) están al final de la página cuando son datos de alto impacto que deberían verse primero.

### Nueva estructura (de arriba a abajo)

1. **Header** (sin cambios) — Nombre, email, botón volver
2. **KPIs numéricos** (sin cambios) — 6 tarjetas en fila
3. **Barra de avance** (sin cambios) — Progreso subtareas
4. **Eficiencia de cierre** ← SUBE (antes estaba después de "Todos los temas")
5. **Cumplimiento de respuesta de correos** ← SUBE
6. **Atrasados + Por Vencer** (sin cambios) — Side by side
7. **Prioridades** (collapsible, sin cambios)
8. **Todos los temas** (collapsible, sin cambios)
9. **Historial de correos** (collapsible, sin cambios)

### Cambio técnico

Mover los bloques de código de "Eficiencia de cierre" (líneas 393-419) y "Cumplimiento de respuesta de correos" (líneas 421-445) para que aparezcan justo después de la barra de avance (después de línea 217), antes del bloque de Atrasados/Por Vencer.

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Reordenar secciones: subir eficiencia de cierre y cumplimiento de correos después de la barra de avance |

