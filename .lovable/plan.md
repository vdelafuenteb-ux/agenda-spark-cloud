

## Plan: Reorganizar ficha del trabajador con pestañas profesionales

### Problema
Las secciones (Temas, Correos, Reprogramaciones, Incidencias) están apiladas como listas desplegables (Collapsible), lo cual se ve poco profesional y desordenado a medida que crece el contenido.

### Solución
Reemplazar las secciones colapsables por un sistema de **Tabs** (pestañas) debajo del bloque de KPIs y score de rendimiento. Las pestañas organizan el contenido en vistas dedicadas con más espacio y detalle.

### Estructura de pestañas

```text
[Resumen]  [Temas (5)]  [Correos (12)]  [Incidencias (2)]
```

1. **Resumen** (default) — KPIs atrasados/por vencer, prioridades, score de rendimiento (lo que ya está arriba antes de los collapsibles)
2. **Temas** — Tabla completa de todos los temas + reprogramaciones integradas (badge 🔄 en cada tema que tenga, y sección inferior con historial de reprogramaciones del trabajador)
3. **Correos** — Historial de correos (el contenido actual del collapsible "Historial de correos")
4. **Incidencias** — Formulario + lista de incidencias (el contenido actual del collapsible "Registro de Incidencias")

### Cambios técnicos

- Eliminar `CollapsibleSection` y su uso
- Importar `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs`
- El header (Volver + nombre) y la fila de KPI cards se mantienen fijos arriba
- El score de rendimiento se mantiene siempre visible
- Debajo del score → `<Tabs>` con las 4 pestañas
- La pestaña "Temas" incluye la tabla de temas + reprogramaciones (fusionar ambos collapsibles)
- Cada TabsContent tiene su propio contenido con scroll interno
- Contadores en cada pestaña: `Temas (5)`, `Correos (12)`, `Incidencias (2)`

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Reemplazar Collapsibles por Tabs; fusionar reprogramaciones dentro de pestaña Temas |

