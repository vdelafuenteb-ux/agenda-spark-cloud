

## Plan: Sub-pestañas en Dashboard + Score en tabla de Responsables

### Problema
La tabla de Responsables está al final del Dashboard, obligando a hacer scroll. El usuario quiere que el Dashboard tenga 2 sub-pestañas: una para los KPIs/gráficos actuales y otra dedicada a Responsables con su tabla completa + puntaje de productividad.

### Solución

**En `src/components/DashboardView.tsx`:**

1. **Agregar Tabs** debajo del título "Dashboard" con 2 pestañas:
   - **Resumen** — contiene todo el contenido actual (KPIs, Cumplimiento, Reprogramaciones, Atrasados, Tendencia) SIN la tabla de Responsables
   - **Responsables** — contiene solo la tabla de responsables mejorada

2. **Mover la tabla de Responsables** (líneas 570-657) a la pestaña "Responsables"

3. **Agregar columna "Score"** a la tabla de responsables:
   - Consultar `score_snapshots` (último snapshot por assignee) vía React Query
   - Mostrar el score como número con color (verde ≥80, amarillo ≥50, rojo <50)
   - Posicionar la columna Score después del Nombre

4. **Mantener funcionalidad existente**: click en nombre → abre ficha del trabajador (AssigneeProfileView)

### Layout resultante
```text
┌─ Dashboard ──────────────────────────────┐
│  [Resumen]  [Responsables (8)]           │
├──────────────────────────────────────────┤
│  Tab Resumen: KPIs + Cierre + Reprog +   │
│               Atrasados + Tendencia      │
│                                          │
│  Tab Responsables: Tabla con Score +     │
│                    Total/Activos/etc     │
└──────────────────────────────────────────┘
```

### Detalle técnico
- Importar `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs`
- Usar `useQuery` para cargar últimos `score_snapshots` (agrupar por `assignee_name`, tomar el más reciente)
- Columna Score: círculo pequeño con número coloreado, similar al estilo del perfil del trabajador

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/DashboardView.tsx` | Agregar Tabs (Resumen / Responsables), mover tabla a su pestaña, agregar columna Score con datos de score_snapshots |

