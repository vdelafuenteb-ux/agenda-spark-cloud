

## Plan: Sistema de Registro de Incidencias por Trabajador

### Resumen
Crear un sistema de registro de incidencias/faltas laborales dentro de la ficha de cada trabajador, con categorización por severidad, historial cronológico, y envío de correo formal al trabajador cuando la falta es grave. Esto sirve como respaldo documentado para gestión de personas.

### 1. Nueva tabla `worker_incidents`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Dueño del registro (jefe) |
| `assignee_name` | text | Nombre del trabajador |
| `assignee_email` | text | Email del trabajador (para correo formal) |
| `category` | enum | `leve`, `moderada`, `grave` |
| `title` | text | Título breve del incidente |
| `description` | text | Detalle de lo ocurrido |
| `incident_date` | date | Fecha del incidente |
| `email_sent` | boolean | Si se envió correo formal |
| `email_sent_at` | timestamptz | Cuándo se envió |
| `created_at` | timestamptz | |

RLS: solo el `user_id` autenticado puede CRUD sus propios registros.

### 2. Nueva pestaña en `AssigneeProfileView`

Agregar una sección colapsable "Registro de Incidencias" con:
- **Botón "Registrar incidencia"** que abre un formulario (modal/dialog)
- **Formulario**: fecha, título, descripción, categoría (Leve/Moderada/Grave)
- **Lista cronológica** de incidencias con badge de color por severidad:
  - 🟡 Leve (amarillo) — observación menor
  - 🟠 Moderada (naranja) — falta que requiere atención
  - 🔴 Grave (rojo) — incumplimiento serio, con opción de enviar correo formal
- **Contador** visible en el título de la sección
- **Botón "Enviar notificación formal"** solo en incidencias graves, que dispara un correo profesional

### 3. Edge Function `send-incident-notification`

Nuevo edge function que envía un correo formal al trabajador (vía la misma API de Firebase) con:
- Tono profesional y respetuoso
- Fecha y descripción del incidente
- Referencia a las obligaciones contractuales
- CC a gerencia (mismos emails que ya se usan)
- Marca `email_sent = true` en el registro

Ejemplo de asunto: *"Notificación formal — Registro de incidencia laboral | [Fecha]"*

### 4. Hook `useIncidents`

Nuevo hook con React Query para CRUD de incidencias:
- `queryKey: ['worker_incidents', assigneeName]`
- Mutations: `createIncident`, `deleteIncident`, `updateIncident`

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Nueva migración | Crear tabla `worker_incidents` con RLS |
| `src/hooks/useIncidents.tsx` | Nuevo hook CRUD |
| `src/components/AssigneeProfileView.tsx` | Nueva sección colapsable con formulario y lista |
| `supabase/functions/send-incident-notification/index.ts` | Nuevo edge function para correo formal |

