

## Plan: Sistema completo de actualización por link — con bitácora diferenciada y auto-confirmación

### Resumen
Implementar todo el flujo de tokens + página pública + diferenciación visual en bitácora + auto-marcado de correos respondidos. Esto requiere cambios en base de datos, 2 nuevas edge functions, 1 nueva página, modificaciones a 3 edge functions de correo existentes, y ajustes al componente de bitácora.

### Cambios

#### 1. Migración: tabla `update_tokens` + columna `source` en `progress_entries`

```sql
-- Tabla de tokens
CREATE TABLE public.update_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assignee_name text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.update_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages tokens" ON public.update_tokens FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Columna source en progress_entries para diferenciar quién escribió
ALTER TABLE public.progress_entries ADD COLUMN source text NOT NULL DEFAULT 'admin';
-- valores: 'admin' (dueño del sistema) o 'assignee' (responsable externo)
```

#### 2. Edge function `validate-update-token/index.ts`
- Público (sin JWT)
- Recibe `{ token }`
- Valida expiración con service role
- Retorna temas del responsable (título, fechas, subtareas pendientes, últimas entradas de bitácora)

#### 3. Edge function `submit-update/index.ts`
- Público (sin JWT)
- Recibe `{ token, updates: [{ topic_id, comment?, subtask_toggles?: [{ id, completed }] }] }`
- Valida token
- Con service role:
  - Inserta `progress_entries` con `source = 'assignee'`
  - Actualiza `subtasks.completed` y `completed_at`
  - **Auto-marca** los `notification_emails` más recientes del responsable como `responded = true` y `responded_at = now()`
- Solo permite insertar comentarios y togglear subtareas — no puede cambiar status, fechas, ni borrar nada

#### 4. Nueva página `src/pages/UpdateTopics.tsx`
- Ruta pública `/update/:token`
- Llama a `validate-update-token` al cargar
- Muestra temas del responsable con:
  - Título, fecha vencimiento, badge de atraso
  - Checkboxes de subtareas pendientes
  - Campo de texto para comentario por tema
- Botón "Enviar actualización"
- Diseño limpio, mobile-friendly, sin sidebar ni login

#### 5. Ruta en `src/App.tsx`
```tsx
<Route path="/update/:token" element={<UpdateTopics />} />
```

#### 6. Modificar 3 edge functions de correo
En `send-notification-email`, `send-bulk-notification` y `send-scheduled-emails`:
- Crear/reusar token con service role antes de enviar
- Agregar botón HTML "📝 Actualizar mis temas" con link a `{APP_URL}/update/{token}`
- `APP_URL` se obtiene de la variable de entorno o se hardcodea como la URL publicada

#### 7. Bitácora con colores diferenciados en `ProgressLog.tsx`
- La interfaz `GenericEntry` ya recibe entries que vienen de `progress_entries`
- En `useTopics.tsx`, el tipo `ProgressEntry` incluirá el nuevo campo `source`
- En `ProgressLog.tsx`, cada entrada se renderiza con fondo diferente:
  - `source === 'admin'` → fondo actual (sin cambio) 
  - `source === 'assignee'` → fondo azul claro (`bg-blue-50 dark:bg-blue-950/30`) con un label pequeño que muestre el nombre del responsable
- Los mensajes del responsable no son editables ni borrables (solo lectura)

### Flujo completo
```text
1. Admin envía correo semanal → se crea token → correo incluye botón "Actualizar"
2. Responsable abre link → ve sus temas con subtareas
3. Escribe comentarios y marca subtareas → envía
4. En la BD: progress_entries con source='assignee', subtasks actualizadas
5. notification_emails del responsable se marcan como responded=true automáticamente
6. Admin abre la bitácora → ve mensajes en azul del responsable, confirmación ya marcada
```

### Seguridad
- Token: 64 chars hex, expira en 7 días, se renueva con cada correo
- Solo INSERT en progress_entries y UPDATE de completed en subtasks
- No permite cambiar status, fechas, títulos ni borrar datos
- Service role solo en edge functions server-side

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Nueva migración | Tabla `update_tokens` + columna `source` en `progress_entries` |
| `supabase/functions/validate-update-token/index.ts` | Nuevo — valida token, retorna temas |
| `supabase/functions/submit-update/index.ts` | Nuevo — guarda comentarios (source=assignee), togglea subtareas, auto-marca respondido |
| `src/pages/UpdateTopics.tsx` | Nuevo — página pública de actualización |
| `src/App.tsx` | Agregar ruta `/update/:token` |
| `src/hooks/useTopics.tsx` | Agregar `source` al tipo `ProgressEntry` |
| `src/components/ProgressLog.tsx` | Colores diferenciados por source, mensajes de assignee en solo lectura |
| `supabase/functions/send-notification-email/index.ts` | Crear token + botón en email |
| `supabase/functions/send-bulk-notification/index.ts` | Crear token + botón en email |
| `supabase/functions/send-scheduled-emails/index.ts` | Crear token + botón en email |

