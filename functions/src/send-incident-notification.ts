import { onCall } from 'firebase-functions/v2/https';
import { requireAuth, sendEmail } from './_shared';

export const sendIncidentNotification = onCall(async (request) => {
  requireAuth(request);
  const data = request.data as {
    to_email: string;
    to_name?: string;
    incident_title: string;
    incident_description?: string;
    incident_date: string;
    category: 'leve' | 'moderada' | 'grave';
  };
  if (!data.to_email || !data.incident_title) throw new Error('Faltan campos requeridos');

  let formattedDate = data.incident_date;
  try {
    formattedDate = new Date(data.incident_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { /* keep as-is */ }

  const categoryLabel: Record<string, string> = { leve: 'Observación menor', moderada: 'Falta moderada', grave: 'Incumplimiento grave' };
  const severityColor: Record<string, string> = { leve: '#f59e0b', moderada: '#f97316', grave: '#dc2626' };
  const color = severityColor[data.category] || '#dc2626';

  let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
  mensaje += `<div style="background:#1a1a2e;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;"><h2 style="margin:0;font-size:18px;font-weight:700;">Notificación Formal de Incidencia Laboral</h2></div>`;
  mensaje += `<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">`;
  mensaje += `<p>Estimado/a <strong>${data.to_name || ''}</strong>,</p>`;
  mensaje += `<p>Por medio de la presente, le informamos que se ha registrado la siguiente incidencia en su historial laboral:</p>`;
  mensaje += `<div style="margin:16px 0;padding:16px;background:#fef2f2;border-radius:8px;border-left:4px solid ${color};">`;
  mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
  mensaje += `<tr><td style="padding:4px 0;color:#888;width:120px;font-weight:600;">Fecha</td><td style="padding:4px 0;">${formattedDate}</td></tr>`;
  mensaje += `<tr><td style="padding:4px 0;color:#888;font-weight:600;">Severidad</td><td style="padding:4px 0;"><span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${categoryLabel[data.category] || data.category}</span></td></tr>`;
  mensaje += `<tr><td style="padding:4px 0;color:#888;font-weight:600;">Asunto</td><td style="padding:4px 0;font-weight:700;">${data.incident_title}</td></tr>`;
  if (data.incident_description) mensaje += `<tr><td style="padding:4px 0;color:#888;font-weight:600;vertical-align:top;">Detalle</td><td style="padding:4px 0;">${data.incident_description}</td></tr>`;
  mensaje += `</table></div>`;
  mensaje += `<p>Le recordamos que el cumplimiento de las normas y procedimientos internos de la empresa es de carácter obligatorio para todos los colaboradores. Esta notificación queda registrada como antecedente formal en su historial laboral.</p>`;
  mensaje += `<p>Si tiene alguna consulta o desea presentar sus descargos respecto a esta situación, puede responder a este correo o comunicarse con su jefatura directa.</p>`;
  mensaje += `<p style="margin-top:20px;">Atentamente,<br/><strong>Gerencia de Operaciones</strong><br/>Transit Global Group</p>`;
  mensaje += `</div></div>`;

  const asunto = data.category === 'grave'
    ? `⚠️ Notificación Formal — Incidencia Laboral Grave | ${formattedDate}`
    : `Notificación — Registro de Incidencia Laboral | ${formattedDate}`;

  await sendEmail({ to: data.to_email, subject: asunto, html: mensaje });
  return { success: true };
});
