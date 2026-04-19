import { onCall } from 'firebase-functions/v2/https';
import { formatDate, requireAuth, sendEmail } from './_shared';

export const sendTopicClosedNotification = onCall(async (request) => {
  requireAuth(request);
  const data = request.data as {
    to_email: string;
    to_name?: string;
    topic_title: string;
    due_date?: string | null;
    closed_at?: string | null;
    is_ongoing?: boolean;
    last_progress_entry?: string | null;
  };
  if (!data.to_email || !data.topic_title) throw new Error('Missing required fields');

  let onTime = true;
  let statusBadge = `<span style="background:#22c55e;color:#fff;padding:4px 12px;border-radius:12px;font-size:14px;font-weight:600;">✅ A tiempo</span>`;
  if (!data.is_ongoing && data.due_date && data.closed_at) {
    const dueD = new Date(data.due_date + 'T23:59:59');
    const closedD = new Date(data.closed_at);
    if (closedD > dueD) {
      onTime = false;
      statusBadge = `<span style="background:#ef4444;color:#fff;padding:4px 12px;border-radius:12px;font-size:14px;font-weight:600;">⚠️ Fuera de plazo</span>`;
    }
  }

  const lastEntryHtml = data.last_progress_entry
    ? `<div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;"><p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:600;">Último avance registrado:</p><p style="margin:0;font-size:14px;color:#1e293b;">${data.last_progress_entry}</p></div>`
    : '';
  const dueDateHtml = data.is_ongoing
    ? `<p style="font-size:14px;color:#64748b;">Tipo: <strong>Tema continuo</strong></p>`
    : data.due_date
      ? `<p style="font-size:14px;color:#64748b;">Fecha comprometida: <strong>${formatDate(data.due_date)}</strong></p>`
      : '';
  const closedDateHtml = data.closed_at
    ? `<p style="font-size:14px;color:#64748b;">Fecha de cierre: <strong>${formatDate(data.closed_at)}</strong></p>`
    : '';

  const html = `
    <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="text-align:center;padding:24px 0;">
        <h1 style="margin:0 0 8px;font-size:24px;color:#1e293b;">🎉 ¡Felicitaciones!</h1>
        <p style="margin:0;font-size:16px;color:#475569;">Se ha cerrado exitosamente el siguiente tema</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:16px 0;">
        <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b;">${data.topic_title}</h2>
        ${dueDateHtml}${closedDateHtml}
        <div style="margin-top:12px;">${statusBadge}</div>
        ${lastEntryHtml}
      </div>
      <p style="text-align:center;font-size:13px;color:#94a3b8;margin-top:24px;">Este correo fue enviado automáticamente por el sistema de gestión.</p>
    </div>`;

  await sendEmail({ to: data.to_email, subject: `✅ Tema cerrado: ${data.topic_title}`, html });
  return { success: true, on_time: onTime };
});
