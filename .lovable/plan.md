

## Plan: Corregir posición de "Revisado" en pestaña "Temas adicionales" + centrar checkbox

### Problema

En la pestaña "Temas adicionales" (new_topic):
1. El body tiene una celda "Enviado" (badge verde) sin header correspondiente — los headers están desalineados con las celdas
2. "Revisado" no está junto a la columna de estado ni centrado

### Cambio en `src/components/EmailHistoryView.tsx`

**Headers (non-weekly):** Agregar header "Estado" para la celda del badge "Enviado", y mover "Revisado" justo después:

Orden final de columnas para `new_topic`:
1. (expand arrow)
2. Estado → badge "Enviado"  
3. **Revisado** → checkbox centrado
4. Persona
5. Email
6. Temas
7. Enviado (fecha)
8. (delete)

**Detalles:**
- Agregar `<th>Estado</th>` antes de `<th>Revisado</th>` cuando `!isWeekly`
- Centrar la celda de Revisado con `text-center` tanto en header como body
- Ajustar `colSpan` en la fila expandida

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/EmailHistoryView.tsx` | Agregar header "Estado" para non-weekly, centrar "Revisado", alinear headers con body |

