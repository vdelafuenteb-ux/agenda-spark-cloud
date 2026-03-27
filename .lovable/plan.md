

## Plan: Mejorar layout de la tarjeta "Cumplimiento de Cierre + Score por Departamento"

### Problema
La tarjeta tiene mucho espacio vacío, especialmente en la mitad derecha (Score por Departamento) cuando hay pocos departamentos. El grid `lg:grid-cols-2` divide en mitades iguales dejando espacio desperdiciado.

### Cambio

**En `src/components/DashboardView.tsx`** (líneas 425-492):

1. Cambiar el grid de `grid-cols-1 lg:grid-cols-2` a `flex flex-col lg:flex-row` para que cada mitad ocupe solo lo necesario
2. La mitad izquierda (Cumplimiento) mantiene su grid de 3 columnas pero con `lg:w-1/2`
3. La mitad derecha (Departamentos) usa `lg:flex-1` y reduce el espacio vertical entre items
4. Reducir `gap-4` a `gap-3` y el padding general

```text
┌─────────────────────────────────────────────────────┐
│ ◎ Cumplimiento de Cierre          12 temas analiz.  │
│                                                     │
│  67%    ● A tiempo   ● Con atraso │ Score x Depto   │
│  Tasa   8            4            │ 1. Depto A — 85 │
│  ████   Prom 3d ant  Prom 4d atr  │ 2. Depto B — 72 │
└─────────────────────────────────────────────────────┘
```

Resultado: sin espacio vacío, ambas mitades bien proporcionadas.

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/DashboardView.tsx` | Ajustar layout flex de la tarjeta de Cumplimiento + Departamentos para eliminar espacio vacío |

