

## Plan: Alerta de triángulo rojo por inactividad en bitácora (+7 días)

### Cambio

Agregar un ícono de triángulo rojo (⚠️ `AlertTriangle`) en la línea de metadatos de cada tarjeta de tema cuando la última entrada en la bitácora (`progress_entries`) tiene más de 7 días de antigüedad, o cuando no hay ninguna entrada. Solo se muestra en temas activos/seguimiento (no completados ni pausados).

### Implementación

**Archivo: `src/components/TopicCard.tsx`**

1. Importar `AlertTriangle` de `lucide-react`
2. Calcular días desde la última entrada de bitácora:
   - Tomar `topic.progress_entries`, ordenar por `created_at` desc, obtener la más reciente
   - Si no hay entradas o la más reciente tiene >7 días → mostrar alerta
3. En la sección de metadatos (línea ~388, donde ya se muestran alertas de subtareas atrasadas), agregar al inicio de `metaParts` un span rojo con `AlertTriangle` + texto "Sin actualizar" cuando aplique
4. Solo para temas no completados y no pausados

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/TopicCard.tsx` | Importar `AlertTriangle`, calcular inactividad de bitácora, renderizar alerta en metadatos |

