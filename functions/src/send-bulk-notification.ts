import { onCall } from 'firebase-functions/v2/https';
import { APP_URL, formatDate, getOrCreateUpdateToken, requireAuth, sendEmail } from './_shared';

interface TopicDTO {
  title: string;
  execution_order?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  subtasks?: Array<{ title: string; completed: boolean; due_date?: string | null }>;
  progress_entries?: Array<{ content: string }>;
}

export const sendBulkNotification = onCall(async (request) => {
  requireAuth(request);
  const uid = request.auth!.uid;
  const { to_email, to_name, topics } = request.data as { to_email: string; to_name?: string; topics: TopicDTO[] };
  if (!to_email || !Array.isArray(topics) || topics.length === 0) {
    throw new Error('Faltan campos requeridos: to_email, topics[]');
  }

  const updateToken = await getOrCreateUpdateToken({ userId: uid, assigneeName: to_name || '' });

  const sorted = [...topics].sort((a, b) => {
    if (a.execution_order != null && b.execution_order != null) return a.execution_order - b.execution_order;
    if (a.execution_order != null) return -1;
    if (b.execution_order != null) return 1;
    return 0;
  });
  const topicsWithPending = sorted.map((t, i) => ({
    ...t,
    pendingSubtasks: (t.subtasks || []).filter((s) => !s.completed),
    num: i + 1,
  }));

  const now = new Date(); now.setHours(0, 0, 0, 0);

  let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
  mensaje += `<p>Hola ${to_name || ''},</p>`;
  mensaje += `<p>Tienes <strong>${topics.length} tema${topics.length > 1 ? 's' : ''}</strong> pendiente${topics.length > 1 ? 's' : ''} de actualizar. <strong>Responde este correo</strong> con el estado de cada uno.</p>`;

  for (const t of topicsWithPending) {
    const pendingText = t.pendingSubtasks.length > 0 ? `${t.pendingSubtasks.length} subtarea${t.pendingSubtasks.length > 1 ? 's' : ''}` : 'Sin pendientes';
    const pendingColor = t.pendingSubtasks.length > 0 ? '#c0392b' : '#888';
    const overdue = t.due_date && new Date(t.due_date) < now;
    const cardBorder = overdue ? 'border-left:4px solid #c0392b;' : 'border-left:4px solid #3498db;';
    const titleColor = overdue ? 'color:#c0392b;' : 'color:#2c3e50;';
    const lastEntry = (t.progress_entries || [])[0]?.content || '';

    mensaje += `<div style="margin:10px 0;padding:10px 14px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
    const orderBadge = t.execution_order != null
      ? `<span style="display:inline-block;background:#2563eb;color:#fff;border-radius:50%;width:24px;height:24px;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:6px;vertical-align:middle;">${t.execution_order}</span>`
      : '';
    mensaje += `<p style="margin:0 0 6px;font-size:14px;font-weight:700;${titleColor}">${orderBadge}${t.title}</p>`;
    mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
    mensaje += `<tr><td style="padding:3px 0;color:#888;width:110px;">Inicio</td><td style="padding:3px 0;">${formatDate(t.start_date) || '—'}</td></tr>`;
    mensaje += `<tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${formatDate(t.due_date) || '—'}</td></tr>`;
    mensaje += `<tr><td style="padding:3px 0;color:#888;">Pendientes</td><td style="padding:3px 0;color:${pendingColor};">${pendingText}</td></tr>`;
    if (lastEntry) mensaje += `<tr><td style="padding:3px 0;color:#888;vertical-align:top;">Último avance</td><td style="padding:3px 0;color:#555;font-size:12px;word-wrap:break-word;">${lastEntry}</td></tr>`;
    mensaje += `</table></div>`;
  }

  mensaje += `<p style="font-size:11px;color:#999;margin:4px 0 12px;">🔴 Las tarjetas con borde rojo indican temas con fecha vencida.</p>`;
  const withPending = topicsWithPending.filter((t) => t.pendingSubtasks.length > 0);
  if (withPending.length > 0) {
    mensaje += `<p style="margin-top:12px;"><strong>Subtareas pendientes:</strong></p>`;
    for (const t of withPending) {
      mensaje += `<p style="margin:8px 0 2px;"><strong>${t.num}. ${t.title}</strong></p><ul style="margin:0;padding-left:20px;">`;
      for (const s of t.pendingSubtasks) {
        mensaje += `<li style="margin-bottom:4px;">${s.title}`;
        if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
        mensaje += `</li>`;
      }
      mensaje += `</ul>`;
    }
  }

  mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
  if (updateToken) {
    mensaje += `<div style="text-align:center;margin:16px 0;"><a href="${APP_URL}/update/${updateToken}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">📝 Actualizar mis temas</a></div>`;
  }
  mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p>`;
  mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p></div>`;

  await sendEmail({
    to: to_email,
    subject: `🚨 ${topics.length} TEMA${topics.length > 1 ? 'S' : ''} ACTIVO${topics.length > 1 ? 'S' : ''} — ¡Actualizar a la brevedad! | Máx. 48 hrs para responder`,
    html: mensaje,
  });
  return { success: true };
});
