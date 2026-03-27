
## Plan: Corregir definitivamente la diferencia de puntajes entre Dashboard y ficha personal

### Problema detectado
Sí hay un error real en el código actual:

- En `DashboardView.tsx` el score se calcula con `computeProductivityScore(a.name, topics)`  
- Pero en `AssigneeProfileView.tsx` el score se calcula con lógica propia y además usa `emailHistory`

Eso hace que el Dashboard esté ignorando la dimensión de correos, por eso Lucas puede salir con `100` en una vista y `84` en su ficha.

Además, hoy existen **dos implementaciones distintas** del mismo cálculo, lo que puede seguir generando diferencias aunque se corrija una sola parte.

### Qué voy a corregir

#### 1. Unificar el cálculo del score en una sola fuente
Usar `src/lib/productivityScore.ts` como la única lógica oficial del score.

#### 2. Corregir el Dashboard
En `src/components/DashboardView.tsx`:
- cargar también los correos de `notification_emails`
- construir un mapa por responsable
- llamar `computeProductivityScore(a.name, topics, emailHistoryDelResponsable)`

Así el score del resumen usará exactamente las mismas variables que la ficha.

#### 3. Corregir la ficha personal
En `src/components/AssigneeProfileView.tsx`:
- dejar de recalcular el score manualmente
- reutilizar `computeProductivityScore(...)`
- seguir usando sus métricas detalladas para barras, cards y desglose visual
- pero el número principal del círculo saldrá desde la utilidad compartida

Así el número grande del perfil y el número del dashboard quedarán iguales siempre.

#### 4. Alinear también el ranking de equipo
En `src/components/TeamView.tsx` todavía existe otra función separada (`calculateAssigneeScore`).
La voy a dejar alineada con la utilidad compartida para evitar otro desfase en esa vista.

### Resultado esperado
Después del ajuste:

- Lucas tendrá el mismo score en Dashboard
- Lucas tendrá el mismo score en su ficha personal
- el ranking del equipo también quedará consistente
- si no hay correos o faltan dimensiones, el peso seguirá redistribuyéndose igual que ahora

### Archivos a tocar
| Archivo | Cambio |
|---|---|
| `src/components/DashboardView.tsx` | incluir correos y calcular score con la utilidad compartida completa |
| `src/components/AssigneeProfileView.tsx` | reemplazar el cálculo duplicado del score por `computeProductivityScore` |
| `src/components/TeamView.tsx` | alinear score/ranking con la misma utilidad |
| `src/lib/productivityScore.ts` | mantenerla como fuente única y, si hace falta, ampliar el retorno para reutilizar datos comunes |

### Nota técnica
La causa raíz no es visual: es de datos/cálculo.  
Ahora mismo una vista está usando:
```ts
score = score basado en topics
```
y la otra:
```ts
score = score basado en topics + notification_emails
```

Por eso no coinciden.

La corrección correcta no es “ajustar un número”, sino hacer que todas las vistas consuman la **misma función + misma data**.
