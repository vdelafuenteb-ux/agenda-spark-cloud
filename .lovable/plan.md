

## Plan: Link en correo de tema nuevo + expiración de token al enviar + filtro por topic_id

### Problema actual
1. El correo de tema nuevo NO incluye link de actualización
2. El token NO caduca después de enviar actualización — se puede reusar
3. La tabla `update_tokens` no tiene campo para filtrar por un solo tema

### Cambios

**1. Migración BD — agregar `topic_id` a `update_tokens`**
- Agregar columna `topic_id uuid nullable` a `update_tokens`
- Agregar columna `used boolean default false`
- Tokens con `topic_id = null` → muestran todos los temas activos (correo semanal)
- Tokens con `topic_id = X` → muestran solo ese tema (correo tema nuevo)

**2. `supabase/functions/submit-update/index.ts` — marcar token como usado**
- Después de procesar las actualizaciones exitosamente, hacer `UPDATE update_tokens SET used = true WHERE token = X`
- En la validación de token, además de verificar expiración, verificar `used = false`

**3. `supabase/functions/validate-update-token/index.ts` — respetar `topic_id` y `used`**
- Si `tokenData.used === true` → error "Ya enviaste tu actualización. Espera el próximo correo."
- Si `tokenData.topic_id` existe → filtrar topics solo por ese `topic_id` en vez de traer todos
- Si `tokenData.topic_id` es null → comportamiento actual (todos los temas activos)

**4. `supabase/functions/send-new-topic-notification/index.ts` — crear token con `topic_id` y agregar botón**
- Crear service-role client para acceder a `update_tokens`
- Insertar token con `{ user_id, assignee_name, topic_id: <el topic creado> }`
- Agregar botón "Actualizar mis temas" con link `/update/:token` en el HTML del correo

**5. `src/pages/UpdateTopics.tsx` — manejar error de token usado**
- Si el error del backend es "Token ya utilizado", mostrar mensaje amigable: "Ya enviaste tu actualización. Recibirás un nuevo link en el próximo correo."

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Migración BD | Agregar `topic_id` y `used` a `update_tokens` |
| `supabase/functions/submit-update/index.ts` | Marcar token `used = true` tras enviar |
| `supabase/functions/validate-update-token/index.ts` | Verificar `used`, filtrar por `topic_id` si existe |
| `supabase/functions/send-new-topic-notification/index.ts` | Crear token con `topic_id`, agregar botón link en email |
| `src/pages/UpdateTopics.tsx` | Mensaje amigable para token ya usado |

