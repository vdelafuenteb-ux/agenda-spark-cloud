

## Plan: Botón "Sin Avances" en la bitácora

### Problema
Los responsables reportan "sin avances" por correo y el usuario necesita registrarlo rápidamente en la bitácora. Actualmente hay que escribirlo manualmente.

### Solución
Agregar un botón "Sin avances" junto a la barra de herramientas de formato que, al hacer clic, inserte automáticamente una entrada predefinida: `**Sin avances esta semana**` en la bitácora.

### Cambios en `src/components/ProgressLog.tsx`

1. Agregar un botón con ícono `Ban` (o `AlertCircle`) y texto "Sin avances" en la barra de herramientas, junto al botón de adjuntar archivo
2. Al hacer clic, llama directamente a `onAdd("**Sin avances esta semana**")` sin necesidad de escribir nada — se registra como entrada inmediata
3. El botón tendrá estilo sutil (variant `outline`, tamaño `sm`, color naranja/muted) para diferenciarlo de las herramientas de formato

### Integración con el KPI de estancamiento (plan anterior aprobado)

Cuando se implemente el KPI de "semanas sin avance" en `AssigneeProfileView`, estas entradas de "Sin avances" **no contarán como actividad real** — el cálculo seguirá basándose en entradas con contenido sustantivo. Esto se puede hacer filtrando entradas que contengan exactamente `**Sin avances esta semana**`.

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/ProgressLog.tsx` | Agregar botón "Sin avances" que registra entrada automática |

