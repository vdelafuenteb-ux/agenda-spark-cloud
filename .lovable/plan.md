

## Plan: Corregir resumen diario para mostrar subtareas individuales (como en Revisión)

### Problema

El correo de resumen diario muestra el **tema** ("Feria Logistec" con fecha 30 abr) cuando en realidad lo atrasado es una **subtarea** dentro de ese tema. La vista de Revisión lo hace correctamente: muestra la subtarea con su fecha y el tema como referencia debajo.

### Solución

Cambiar la lógica del edge function `send-daily-summary` para que en lugar de agrupar por tema, muestre **filas individuales por subtarea** (y solo el tema si no tiene subtareas que coincidan), igual que `buildItems` en `ReviewView.tsx`.

### Cambios en `supabase/functions/send-daily-summary/index.ts`

**Categorización (líneas 109-131)**: En vez de pushear el topic completo con `matchCount`, construir una lista de items individuales:

```text
Estructura actual:         Estructura nueva:
─────────────────         ─────────────────
Topic "Feria"  (1)        Subtarea "X" → Tema: Feria (vence: 20 mar)
                          
Topic "Cargo"  (1)        Topic "Cargo" (vence: 19 mar)
```

Cada item tendrá: `title`, `parentTitle` (si es subtarea), `assignee`, `dueDate`, `type` ('subtask' | 'topic').

**Tabla HTML (`buildSection`)**: Actualizar para mostrar:
- Columna "Item" con el título de la subtarea
- Debajo en gris: `→ Tema padre` (si es subtarea)
- Columna "Vence" con la fecha de la subtarea/tema correspondiente
- Eliminar columna "Items" (ya no aplica, cada fila es un item)

### Tabla resultante en el correo

| Item | Responsable | Vence |
|---|---|---|
| Seguimiento Clientes<br>`→ Cargo Aviation` | Matias Sapunar | 19 mar |
| Documentación respaldo... | Vicente Godoy | 20 mar |
| Check List cosas por hacer<br>`→ Feria Logistec` | Gabriel Rojas | 20 mar |

### Archivo a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/send-daily-summary/index.ts` | Refactorizar categorización para items individuales y actualizar `buildSection` |

