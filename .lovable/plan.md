

## Plan: Score de productividad circular + clarificar etiquetas

### Cambios

**1. Clarificar etiquetas**
- "Eficiencia de cierre" → "Eficiencia de cierre de temas"

**2. Score circular de productividad (0-100)**

Agregar un círculo SVG prominente al inicio de la tarjeta de Rendimiento que muestre una puntuación global calculada objetivamente.

**Metodología de cálculo — Score de Productividad (0-100):**

| Dimensión | Peso | Qué mide | Cálculo |
|---|---|---|---|
| Cierre a tiempo | 40% | % de temas cerrados dentro del plazo | `(cierres a tiempo / total cierres) × 100` |
| Respuesta de correos | 25% | % de correos respondidos dentro de 48h | `(respuestas a tiempo / total confirmados) × 100` |
| Avance de subtareas | 20% | % de subtareas completadas | `(completadas / total) × 100` |
| Cumplimiento de plazos | 15% | % de temas activos que NO están atrasados | `(activos al día / total activos) × 100` |

**Score = (cierre×0.40) + (correos×0.25) + (subtareas×0.20) + (plazos×0.15)**

- Si no hay datos para una dimensión (ej: 0 temas cerrados), su peso se redistribuye proporcionalmente entre las otras.

**Escala visual:**
- 90-100: Verde — Excelente
- 70-89: Verde claro — Bueno
- 50-69: Amarillo — Regular
- 30-49: Naranja — Bajo
- 0-29: Rojo — Crítico

**Diseño UI:**
- Círculo SVG con el score en el centro (número grande + texto "pts" pequeño)
- Color del arco según la escala
- Etiqueta debajo: "Excelente", "Bueno", etc.
- Posición: lado izquierdo de la tarjeta Rendimiento, con las 3 barras de progreso a la derecha

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Agregar cálculo de score, círculo SVG, renombrar etiqueta, reestructurar layout de la tarjeta Rendimiento |

