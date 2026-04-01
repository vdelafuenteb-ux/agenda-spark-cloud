

## Plan: Sub-filtro "Continuos" / "Con fecha" en pestaña Activos

### Cambio

Agregar un grupo de botones pequeños (toggle group) debajo de las pestañas principales, visible **solo cuando `statusTab === 'activo'`**, con 3 opciones:
- **Todos** (por defecto) — muestra todos los temas activos
- **Continuos** — solo `is_ongoing === true`
- **Con fecha** — solo `is_ongoing !== true` (temas con fecha definida)

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/pages/Index.tsx` | Agregar estado `activeSubFilter` (`'all' | 'ongoing' | 'dated'`), renderizar toggle group entre Tabs y FilterBar cuando activo, aplicar filtro en `filteredTopics`, resetear al cambiar de pestaña |

### Detalle técnico

1. Nuevo estado: `const [activeSubFilter, setActiveSubFilter] = useState<'all' | 'ongoing' | 'dated'>('all')`
2. Resetear a `'all'` en el `onValueChange` de Tabs (línea 474)
3. Renderizar entre las Tabs y el FilterBar (línea ~482) un grupo de 3 botones pequeños con estilo similar a pills/chips
4. En `filteredTopics` (línea ~96-97): cuando `statusTab === 'activo'` y `activeSubFilter !== 'all'`, filtrar por `is_ongoing` según corresponda. Este filtro reemplaza/complementa los toggles existentes de `showOngoing`/`showNotOngoing` del FilterBar solo para la pestaña activa

