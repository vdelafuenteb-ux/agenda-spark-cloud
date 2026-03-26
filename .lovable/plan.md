

## Plan: Botón "Ver tendencias" + flecha de tendencia en el círculo de score

### Cambios en `src/components/AssigneeProfileView.tsx`

**1. Mover gráfico de tendencia a un modal/toggle**
- Reemplazar el bloque del gráfico (líneas 424-446) que se muestra siempre como Card separada
- Agregar un botón "Ver tendencias" encima del círculo de score (dentro de la tarjeta Rendimiento)
- Al hacer clic, mostrar un `Dialog` con el gráfico de tendencia (LineChart)
- El botón aparece solo cuando hay ≥1 snapshot

**2. Flecha de tendencia dentro del círculo**
- Usar los `scoreSnapshots` para comparar el score actual vs el de la semana anterior
- Si subió → flecha verde `↑` (ChevronUp o TrendingUp)
- Si bajó → flecha roja `↓` (ChevronDown o TrendingDown)
- Si igual → símbolo `=` gris
- Mostrar la flecha debajo del número "pts" dentro del SVG del círculo, usando un pequeño ícono o texto

### Detalle técnico
- Calcular `previousScore` del último snapshot antes del actual (penúltimo en el array)
- Comparar con `metrics.productivityScore` actual
- Agregar import de `Dialog` components y el ícono `TrendingDown`
- El botón será tipo `ghost` con ícono de gráfico, texto "Tendencias"

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/AssigneeProfileView.tsx` | Agregar botón tendencias + dialog con gráfico + flecha de tendencia en SVG circle |

