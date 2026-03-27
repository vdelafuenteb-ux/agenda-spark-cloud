

## Plan: Mostrar KPIs de reprogramaciones siempre (incluso en 0) en formato compacto

### Problema
La sección de Reprogramaciones en el Dashboard solo se muestra cuando `reschedules.length > 0`. Si no hay reprogramaciones, no aparece nada — ni siquiera los indicadores en 0. El usuario quiere verlos siempre.

### Solución
En `DashboardView.tsx`:

1. **Quitar la condición `reschedules.length > 0`** para que la card siempre se renderice
2. **Compactar la card** en una sola fila horizontal de 4 KPIs (Total, Prom/tema, Extensión, Sobretiempo%) dentro de una card del mismo estilo que las 4 KPIs superiores, sin la lista de "Temas más reprogramados" que alarga el dashboard — esa lista se mueve como tooltip o se elimina
3. **Diseño**: Una card compacta tipo fila con los 6 indicadores actuales condensados a 4 principales en una línea, similar a la fila de KPIs de arriba (Temas Totales, Estado de Plazos, etc.)

Layout resultante:
```text
┌─────────────────────────────────────────────────────────┐
│ 🔄 Reprogramaciones                                     │
│  0 total · 0 internas · 0 externas │ 0x prom · +0d · +0%│
└─────────────────────────────────────────────────────────┘
```

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/components/DashboardView.tsx` | Quitar condición `reschedules.length > 0`, compactar card de reprogramaciones en formato de fila resumida |

