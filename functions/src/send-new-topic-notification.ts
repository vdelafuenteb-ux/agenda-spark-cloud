import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { APP_URL, createUpdateToken, formatDate, requireAuth, sendEmail } from './_shared';

export const sendNewTopicNotification = onCall(async (request) => {
  try {
  const uid = requireAuth(request);
  const data = request.data as {
    to_email: string;
    to_name?: string;
    topic_title: string;
    topic_id?: string;
    start_date?: string | null;
    due_date?: string | null;
    subtasks?: Array<{ title: string; completed: boolean; due_date?: string | null }>;
    is_urgent?: boolean;
    days_until_due?: number;
    initial_note?: string;
  };
  if (!data.to_email || !data.topic_title) throw new Error('Faltan campos requeridos');

  let updateToken: string | null = null;
  if (data.topic_id && data.to_name) {
    updateToken = await createUpdateToken({ userId: uid, assigneeName: data.to_name, topicId: data.topic_id });
  }

  const pendingSubtasks = (data.subtasks || []).filter((s) => !s.completed);
  const pendingCount = pendingSubtasks.length;
  const asunto = data.is_urgent
    ? `⚠️ Nuevo tema URGENTE agregado — vence en ${data.days_until_due} día${data.days_until_due !== 1 ? 's' : ''}`
    : `📋 Nuevo tema agregado a tu listado de seguimiento`;

  const isOverdue = !!data.due_date && new Date(data.due_date) < new Date(new Date().toDateString());
  const cardBorder = isOverdue ? 'border-left:4px solid #c0392b;' : 'border-left:4px solid #3498db;';
  const titleColor = isOverdue ? 'color:#c0392b;' : 'color:#2c3e50;';

  let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
  mensaje += `<p>Hola ${data.to_name || ''},</p>`;
  if (data.is_urgent) {
    mensaje += `<p style="color:#c0392b;font-weight:bold;">⚠️ Se ha agregado un nuevo tema a tu listado de seguimiento que requiere atención urgente (vence en ${data.days_until_due} día${data.days_until_due !== 1 ? 's' : ''}).</p>`;
  } else {
    mensaje += `<p>Se ha agregado un nuevo tema a tu listado de seguimiento para que lo tengas en consideración. Este tema aparecerá en tu reporte del próximo lunes.</p>`;
  }

  mensaje += `<div style="margin:16px 0;padding:12px 16px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
  mensaje += `<p style="margin:0 0 8px;font-size:16px;font-weight:700;${titleColor}">${data.topic_title}</p>`;
  mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
  mensaje += `<tr><td style="padding:4px 0;color:#888;width:100px;">Inicio</td><td style="padding:4px 0;font-weight:500;">${formatDate(data.start_date) || '—'}</td></tr>`;
  mensaje += `<tr><td style="padding:4px 0;color:#888;">Vencimiento</td><td style="padding:4px 0;font-weight:500;">${formatDate(data.due_date) || '—'}</td></tr>`;
  mensaje += `<tr><td style="padding:4px 0;color:#888;">Subtareas</td><td style="padding:4px 0;font-weight:500;">${pendingCount > 0 ? `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}` : 'Sin subtareas'}</td></tr>`;
  mensaje += `</table></div>`;

  if (pendingCount > 0) {
    mensaje += `<p style="margin-top:16px;"><strong>Subtareas:</strong></p><ul style="margin:0;padding-left:20px;">`;
    for (const s of pendingSubtasks) {
      mensaje += `<li style="margin-bottom:4px;">${s.title}`;
      if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
      mensaje += `</li>`;
    }
    mensaje += `</ul>`;
  }

  if (data.initial_note) {
    const formattedNote = data.initial_note.replace(/\n/g, '<br>');
    mensaje += `<div style="margin:16px 0;padding:12px 16px;background:#f8f9fa;border-left:3px solid #6c757d;border-radius:4px;">`;
    mensaje += `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#555;text-transform:uppercase;">📝 Detalle / Instrucciones</p>`;
    mensaje += `<p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;">${formattedNote}</p></div>`;
  }

  if (updateToken) {
    mensaje += `<div style="margin:20px 0;text-align:center;"><a href="${APP_URL}/update/${updateToken}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">📝 Actualizar este tema</a></div>`;
    mensaje += `<p style="font-size:12px;color:#999;text-align:center;">Este link es de uso único. Una vez envíes tu actualización, expirará automáticamente.</p>`;
  }
  mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
  mensaje += data.is_urgent
    ? `<p><strong>⚠️ Este tema es urgente. Por favor revísalo a la brevedad.</strong></p>`
    : `<p style="font-size:13px;color:#666;">Este correo es informativo. El detalle completo lo recibirás en el reporte del próximo lunes.</p>`;
  mensaje += `</div>`;

  await sendEmail({ to: data.to_email, subject: asunto, html: mensaje });
  return { success: true };
  } catch (e: any) {
    console.error('[sendNewTopicNotification] error:', e);
    throw new HttpsError('internal', e?.message || 'Error enviando notificación');
  }
});
