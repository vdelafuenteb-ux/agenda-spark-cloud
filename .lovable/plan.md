

## Diagnóstico: Diferencia de conteo entre tablero principal (16) y equipo (14)

### Causa raíz

La pestaña principal "Activos" cuenta **todos** los temas activos no archivados (16), incluyendo temas sin responsable asignado. La vista de Equipo suma los temas **por responsable** — si un tema activo no tiene responsable (campo `assignee` vacío o null), no aparece en el conteo de ninguna persona. La diferencia de 2 significa que tienes 2 temas activos sin responsable asignado.

### No es un bug

Esto no es un error de cálculo, es una diferencia de perspectiva:
- **Tablero**: "¿Cuántos temas activos tengo en total?" → 16
- **Equipo**: "¿Cuántos temas tiene cada persona?" → suma = 14 (porque 2 no tienen dueño)

### Solución propuesta

Agregar en la vista de Equipo un indicador de **temas sin asignar** para que el total cuadre visualmente:

| Archivo | Cambio |
|---|---|
| `src/components/TeamView.tsx` | Mostrar un contador "Sin asignar: X temas" debajo de los KPIs de departamento cuando hay temas activos sin responsable |

Así cuando entres a Equipo verás: 14 asignados + 2 sin asignar = 16 total, y todo cuadra.

