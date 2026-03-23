

## Plan: Optimización completa para teléfono móvil

Tras revisar todos los componentes de la app, identifiqué los siguientes problemas de usabilidad en pantallas pequeñas:

### Problemas encontrados

1. **FilterBar**: Los botones "Expandir", "Sin fecha fin" y "Correo masivo" no se ajustan bien en móvil — se desbordan horizontalmente porque están en una sola fila con `shrink-0`.

2. **TopicCard (header compacto)**: La línea 1 (título + fecha + contadores) se aprieta demasiado en móvil. Los metadatos de la línea 2 (responsable, tags, prioridad, barra de progreso) se amontonan.

3. **TopicCard (expanded)**: Los botones de acción (Seguimiento/Pausar/Cerrar) con `flex-1` se hacen muy estrechos en <375px. Las fechas Inicio/Fin están en línea y no caben.

4. **SubtaskRow**: Demasiados elementos en una fila (checkbox + título + badges + eye + last activity + date + delete). En móvil se recorta todo. El botón de borrar con `opacity-0 group-hover:opacity-100` es invisible en touch (no hay hover).

5. **CalendarView**: Las celdas del calendario son muy pequeñas en móvil (min-h-[56px]) y los eventos de 9px son casi ilegibles.

6. **NoteEditor toolbar**: La barra superior tiene demasiados selects e iconos en una fila — se desborda en móvil.

7. **DashboardView - Cumplimiento de Cierre**: El grid `grid-cols-2 lg:grid-cols-4` puede apretar mucho los 4 items en 2 columnas en pantallas pequeñas.

8. **ReviewView filtros**: Los selects de Responsable y Estado están en fila y pueden no caber.

9. **Tabs status (Index)**: Los 4 TabsTrigger con texto + números se aprietan en pantallas <375px.

10. **ReminderManager**: Los selects del formulario de creación no están adaptados a móvil.

### Cambios por archivo

**1. `src/components/FilterBar.tsx`**
- Hacer que los botones de acción (Expandir/Sin fecha/Correo) se envuelvan en móvil con `flex-wrap`
- Ocultar texto de los botones en móvil, mostrar solo iconos

**2. `src/components/TopicCard.tsx`**
- En el header compacto: mover la fecha y contadores debajo del título en móvil
- En expanded: hacer `flex-wrap` en los botones de acción y las fechas
- Hacer `w-full` el select de departamento en móvil en vez de `w-48`

**3. `src/components/SubtaskRow.tsx`**
- Hacer visible el botón de borrar siempre en touch (quitar `opacity-0 group-hover:opacity-100`, usar `sm:opacity-0 sm:group-hover:opacity-100`)
- Ocultar "last activity" en móvil para liberar espacio (`hidden sm:inline`)
- Reorganizar los badges para que no se amontonen

**4. `src/components/CalendarView.tsx`**
- Aumentar min-height de celdas en móvil
- Hacer que en móvil solo se muestren los dots de color sin texto de eventos (el texto se ve en el popover al tocar)

**5. `src/components/NoteEditor.tsx`**
- Hacer la barra superior scrollable horizontalmente en móvil con `overflow-x-auto`
- Reducir los selects de notebook/section a iconos en móvil

**6. `src/components/DashboardView.tsx`**
- Cambiar el grid de cumplimiento de cierre a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

**7. `src/pages/Index.tsx`**
- Hacer los TabsTrigger más compactos: en móvil mostrar solo abreviaciones o quitar el conteo

**8. `src/components/ReviewView.tsx`**
- Hacer los selects de filtro `w-full` en móvil con `flex-wrap`

**9. `src/components/ReminderManager.tsx`**
- Hacer los selects del formulario stack vertical en móvil

### Archivos a modificar
1. `src/components/FilterBar.tsx`
2. `src/components/TopicCard.tsx`
3. `src/components/SubtaskRow.tsx`
4. `src/components/CalendarView.tsx`
5. `src/components/NoteEditor.tsx`
6. `src/components/DashboardView.tsx`
7. `src/pages/Index.tsx`
8. `src/components/ReviewView.tsx`
9. `src/components/ReminderManager.tsx`

