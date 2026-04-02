

## Plan: Mejorar badge de prioridad de ejecución

### Problema actual

1. El badge solo muestra el número (ej: "3") sin contexto — no queda claro que es la prioridad
2. Los temas ya se ordenan por `execution_order` (el sorting funciona), pero visualmente no se distingue bien

### Cambio

**Archivo: `src/components/TopicCard.tsx`**

Reemplazar el badge circular con solo el número por un badge tipo etiqueta más descriptivo y ejecutivo:

- Formato: `P1`, `P2`, `P3` (P de Prioridad) dentro de un badge rectangular redondeado
- O alternativamente: `#1`, `#2`, `#3` con un label "Prioridad" en tooltip
- Color: azul primario para prioridades 1-3, gris para el resto
- Tamaño más grande y con texto "Prioridad" visible como sub-texto o label

Propuesta visual:
```
[🏷 P1]  Facturas API 2025...
[🏷 P2]  Desarrollo Plataforma...
[🏷 P3]  Patentes comerciales...
```

El badge sería un rectángulo redondeado con fondo azul, texto blanco, y un icono pequeño de bandera o medalla para que se entienda de inmediato que es el orden de prioridad.

Ejemplo de estilo:
- Badge: `bg-primary text-white rounded-md px-2 py-0.5 text-xs font-bold` con texto `P1`
- Tooltip al pasar el mouse: "Prioridad de ejecución #1"

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/TopicCard.tsx` | Cambiar badge circular por badge rectangular con "P1/P2/P3" más descriptivo y ejecutivo |

