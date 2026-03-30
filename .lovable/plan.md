

## Plan: Sincronizar pestaña de correos con KPIs + separar por tipo

### Problema

La pestaña "Correos" en el perfil del responsable muestra **todos** los correos (weekly + new_topic = 34) sin distinguir tipo, pero los KPIs solo cuentan los `weekly` (11 confirmados). Esto genera confusión porque:
- KPI dice "Total: 11, Fuera de plazo: 2" 
- La lista muestra 34 correos, muchos con "Fuera de plazo" porque incluye `new_topic` con confirmaciones tardías del bug anterior

### Corrección en `src/components/AssigneeProfileView.tsx`

**1. Separar la lista de correos en dos sub-pestañas** (igual que EmailHistoryView):
- "Semanales" (weekly) — por defecto
- "Temas nuevos" (new_topic)

**2. Solo aplicar badge "A tiempo / Fuera de plazo" a correos weekly**
- Para `new_topic`: mostrar solo si está confirmado o no, sin evaluar la regla de 48h (no aplica)

**3. Actualizar los stats del header** para que reflejen la sub-pestaña seleccionada

### Resultado
- Al entrar a la pestaña "Correos" de Godoy, verá por defecto los 31 semanales
- Los KPIs (A tiempo: 9, Fuera de plazo: 2, Total: 11) coincidirán con la lista
- Los 3 correos de tema nuevo estarán en su propia sub-pestaña sin badge de plazo

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Agregar tabs weekly/new_topic en pestaña Correos, badge solo para weekly |

