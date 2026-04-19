import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { APP_URL, formatDate, getOrCreateUpdateToken, requireAuth, sendEmail } from './_shared';

export const sendNotificationEmail = onCall(async (request) => {
  try {
  const uid = requireAuth(request);
  const data = request.data as {
    to_email: string;
    to_name?: string;
    topic_title: string;
    topic_id?: string;
    execution_order?: number | null;
    subtasks?: Array<{ title: string; completed: boolean; due_date?: string | null; notes?: string }>;
    start_date?: string | null;
    due_date?: string | null;
    progress_entries?: Array<{ content: string }>;
  };
  if (!data.to_email || !data.topic_title) {
    throw new Error('Faltan campos requeridos: to_email, topic_title');
  }

  const updateToken = await getOrCreateUpdateToken({
    userId: uid,
    assigneeName: data.to_name || '',
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const pendingSubtasks = (data.subtasks || []).filter((s) => !s.completed);
  const entries = (data.progress_entries || []).slice(0, 5);
  const lastEntry = entries.length > 0 ? entries[0]?.content || '' : '';
  const pendingCount = pendingSubtasks.length;
  const pendingText = pendingCount > 0 ? `${pendingCount} subtarea${pendingCount > 1 ? 's' : ''}` : 'Sin pendientes';
  const pendingColor = pendingCount > 0 ? '#c0392b' : '#888';
  const isOverdue = !!data.due_date && new Date(data.due_date) < now;
  const cardBorder = isOverdue ? 'border-left:4px solid #c0392b;' : 'border-left:4px solid #3498db;';
  const titleColor = isOverdue ? 'color:#c0392b;' : 'color:#2c3e50;';

  let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
  mensaje += `<p>Hola ${data.to_name || ''},</p>`;
  mensaje += `<p>Tienes <strong>1 tema</strong> pendiente de actualizar. <strong>Responde este correo</strong> con el estado.</p>`;
  mensaje += `<div style="margin:12px 0;padding:12px 16px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
  const orderBadge = data.execution_order != null
    ? `<span style="display:inline-block;background:#2563eb;color:#fff;border-radius:50%;width:24px;height:24px;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:6px;vertical-align:middle;">${data.execution_order}</span>`
    : '';
  mensaje += `<p style="margin:0 0 8px;font-size:15px;font-weight:700;${titleColor}">${orderBadge}${data.topic_title}</p>`;
  mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
  mensaje += `<tr><td style="padding:3px 0;color:#888;width:110px;">Inicio</td><td style="padding:3px 0;">${formatDate(data.start_date) || '—'}</td></tr>`;
  mensaje += `<tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${formatDate(data.due_date) || '—'}</td></tr>`;
  mensaje += `<tr><td style="padding:3px 0;color:#888;">Pendientes</td><td style="padding:3px 0;color:${pendingColor};">${pendingText}</td></tr>`;
  if (lastEntry) mensaje += `<tr><td style="padding:3px 0;color:#888;vertical-align:top;">Último avance</td><td style="padding:3px 0;color:#555;font-size:12px;word-wrap:break-word;">${lastEntry}</td></tr>`;
  mensaje += `</table></div>`;
  if (isOverdue) mensaje += `<p style="font-size:12px;color:#c0392b;margin:0 0 12px;">🔴 Este tema tiene fecha de vencimiento ya pasada.</p>`;
  if (pendingCount > 0) {
    mensaje += `<p style="margin-top:12px;"><strong>Subtareas pendientes:</strong></p><ul style="margin:0;padding-left:20px;">`;
    for (const s of pendingSubtasks) {
      mensaje += `<li style="margin-bottom:4px;">${s.title}`;
      if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
      if (s.notes) mensaje += `<br/><span style="color:#666;font-size:12px;">📝 ${s.notes}</span>`;
      mensaje += `</li>`;
    }
    mensaje += `</ul>`;
  }
  mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
  if (updateToken) {
    mensaje += `<div style="text-align:center;margin:16px 0;"><a href="${APP_URL}/update/${updateToken}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">📝 Actualizar mis temas</a></div>`;
  }
  mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p>`;
  mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p></div>`;

  await sendEmail({
    to: data.to_email,
    subject: `🚨 1 TEMA ACTIVO — ¡Actualizar a la brevedad! | Máx. 48 hrs para responder`,
    html: mensaje,
  });
  return { success: true };
  } catch (e: any) {
    console.error('[sendNotificationEmail] error:', e);
    throw new HttpsError('internal', e?.message || 'Error enviando correo');
  }
});
