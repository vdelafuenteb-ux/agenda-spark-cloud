

## Plan: Corregir KPIs de correos — 3 bugs encontrados

### Diagnóstico

Analicé los datos reales en la BD y encontré **3 bugs** que causan los puntajes incorrectos:

**Bug 1 — `submit-update` sobreescribe TODOS los correos históricos (CRÍTICO)**
Cuando alguien envía su actualización vía link, la función marca TODOS sus correos no respondidos como `confirmed_at = ahora()`. Ejemplo: Godoy tiene 34 correos, todos con `confirmed_at = 2026-03-30 15:31`. Un correo enviado el 18 de marzo ahora dice "confirmado el 30 de marzo" = 12 días de demora → "fuera de plazo". Resultado: **22 de 31 correos aparecen como "fuera de plazo"** cuando en realidad respondió a tiempo.

**Bug 2 — Se mezclan correos semanales con correos de tema nuevo**
`computeProductivityScore` y `AssigneeProfileView` cuentan TODOS los correos (weekly + new_topic) para el KPI de cumplimiento. La edge function `save-score-snapshots` sí filtra solo `weekly`. Esto causa inconsistencia y infla el denominador.

**Bug 3 — No se filtra por email_type en las queries del Dashboard y TeamView**
Las queries que alimentan los scores (`notification_emails_all_dashboard`, `notification_emails_team`) no filtran por `email_type`, mezclando todo.

### Correcciones

**1. `supabase/functions/submit-update/index.ts` (líneas 121-134)**
- Cambiar el UPDATE para que solo confirme correos enviados en los **últimos 7 días** que no estén ya confirmados
- Filtro: `.eq("confirmed", false).gte("sent_at", fecha7DiasAtras)`
- Así no toca correos históricos que ya pasaron su ventana

**2. `src/lib/productivityScore.ts` (línea 18-19)**
- Agregar `email_type` al tipo del parámetro emailHistory
- Filtrar internamente solo `email_type === 'weekly'` antes de calcular compliance

**3. `src/components/AssigneeProfileView.tsx` (líneas 173-183)**
- Filtrar `emailHistory` por `email_type === 'weekly'` para las métricas de correos
- Los correos de "tema nuevo" no deben contar en el KPI de cumplimiento de 48h

**4. `src/components/DashboardView.tsx` (línea 63)**
- Agregar `.eq('email_type', 'weekly')` a la query de emails del dashboard

**5. `src/components/TeamView.tsx`**
- Mismo filtro `.eq('email_type', 'weekly')` en la query de emails del equipo

**6. Migración BD — corregir datos históricos**
- RESET de `confirmed`/`confirmed_at` en correos donde `confirmed_at - sent_at > 7 días` (fueron confirmados erróneamente por el bug del bulk update)
- Esto limpia los datos corruptos de Godoy y otros

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/submit-update/index.ts` | Solo confirmar correos recientes (≤7 días) no confirmados |
| `src/lib/productivityScore.ts` | Filtrar solo `email_type = 'weekly'` |
| `src/components/AssigneeProfileView.tsx` | Filtrar métricas de correos por `weekly` |
| `src/components/DashboardView.tsx` | Filtrar query por `email_type = 'weekly'` |
| `src/components/TeamView.tsx` | Filtrar query por `email_type = 'weekly'` |
| Migración BD | Reset de confirmaciones erróneas (>7 días de diferencia) |

