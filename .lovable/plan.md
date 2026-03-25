

## Plan: Notificación de tema nuevo agregado al responsable

### Resumen

Cuando se crea un tema en estado "seguimiento" con responsable asignado, enviar automáticamente un correo informativo al responsable notificándole que se agregó un nuevo tema a su listado. Este correo es **informativo** (sin plazo de 48h obligatorio), a menos que la fecha de cierre del tema sea dentro de 1-2 días, en cuyo caso se menciona la urgencia.

---

### Flujo

1. Se crea un tema con estado "seguimiento" y responsable asignado
2. El sistema verifica que el responsable tenga correo configurado
3. Se envía automáticamente un correo con:
   - **Asunto**: `📋 Nuevo tema agregado a tu listado de seguimiento`
   - **Cuerpo**: Detalle del tema (título, fecha inicio, fecha cierre, subtareas)
   - **Si la fecha de cierre es ≤ 2 días**: Se agrega advertencia de urgencia con plazo
   - **Sin plazo de 48h** para responder (no es un recordatorio)
4. Se registra en `notification_emails` para el historial
5. Se muestra un toast confirmando el envío

### Archivos a crear/modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/send-new-topic-notification/index.ts` | **Nuevo** — Edge function para enviar correo informativo de tema nuevo |
| `src/pages/Index.tsx` | Después de crear un tema "seguimiento" con responsable, invocar la edge function y registrar en historial |

### Edge Function: `send-new-topic-notification`

Recibe: `to_email`, `to_name`, `topic_title`, `start_date`, `due_date`, `subtasks`, `is_urgent` (si due_date ≤ 2 días).

Construye HTML similar al existente pero con tono informativo:
- Asunto: `📋 Nuevo tema agregado a tu listado de seguimiento`
- Si es urgente: `⚠️ Nuevo tema URGENTE agregado — vence en [X] días`
- CC a Matías y Vicente (misma lógica actual)
- Sin mención de "48 horas para responder" salvo que sea urgente

### Cambio en `Index.tsx` → `handleCreateTopic`

Al final del flujo de creación, si `status === 'seguimiento'` y hay `assignee` con email:
1. Calcular si es urgente: `due_date` existe y es ≤ 2 días desde hoy
2. Invocar `send-new-topic-notification`
3. Registrar en `notification_emails` via insert directo
4. Toast informativo: "Se notificó a [nombre] del nuevo tema"
5. Si falla el envío, solo warning (no bloquea la creación)

### Notas técnicas
- No requiere cambios de base de datos
- El correo se registra en `notification_emails` igual que los demás, para que aparezca en el historial
- Se reutiliza la misma infraestructura de Firebase email (`FIREBASE_EMAIL_URL`)

