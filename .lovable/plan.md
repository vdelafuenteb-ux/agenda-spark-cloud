

## Plan: Compact KPI cards — single row, smaller text, cleaner layout

### Problem
The 4 KPI cards (Temas Totales, Estado de Plazos, Subtareas, Cerrados) are too wide and the "Estado de Plazos" card wraps its indicators to multiple lines. The user wants all cards in one row, narrower, with smaller but formal text.

### Changes in `src/components/DashboardView.tsx`

**KPI Cards section (lines 277-340):**

1. Reduce padding from `p-4` to `p-3` on all CardContent elements
2. Reduce main number size from `text-2xl` to `text-xl`
3. Reduce label size from `text-xs` to `text-[11px]`
4. For "Estado de Plazos" card: put all 3 indicators (al día, por vencer, atrasados) in a single row using `flex-nowrap` with tighter `gap-2`, reduce the number size from `text-lg` to `text-sm font-bold`, and the dot from `h-3 w-3` to `h-2.5 w-2.5`
5. Keep the grid as `grid-cols-2 lg:grid-cols-4` but add `max-w-5xl` to constrain overall width

No other files affected.

