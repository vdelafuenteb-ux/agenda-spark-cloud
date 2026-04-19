import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { APP_URL, chileDate, db, formatDate, getOrCreateUpdateToken, sendEmail } from './_shared';

async function run(): Promise<{ success: boolean; emails_sent: number }> {
  const { day, hour } = chileDate();
  const schedulesSnap = await db()
    .collection('email_schedules')
    .where('enabled', '==', true)
    .where('day_of_week', '==', day)
    .where('send_hour', '==', hour)
    .get();
  if (schedulesSnap.empty) return { success: true, emails_sent: 0 };

  let emailsSent = 0;

  for (const schedDoc of schedulesSnap.docs) {
    const schedule = { id: schedDoc.id, ...(schedDoc.data() as any) };

    const topicsSnap = await db().collection('topics').where('user_id', '==', schedule.user_id).where('status', '==', 'seguimiento').get();
    let relevantTopics = topicsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
    if (!schedule.send_all_topics && schedule.selected_topic_ids?.length > 0) {
      const sel = new Set<string>(schedule.selected_topic_ids);
      relevantTopics = relevantTopics.filter((t) => sel.has(t.id));
    }
    if (relevantTopics.length === 0) continue;

    // Fetch subtasks + progress for these topics (chunk by 30)
    const topicIds = relevantTopics.map((t) => t.id);
    const subtasksByTopic = new Map<string, any[]>();
    const entriesByTopic = new Map<string, any[]>();
    for (let i = 0; i < topicIds.length; i += 30) {
      const ch = topicIds.slice(i, i + 30);
      const [subs, ents] = await Promise.all([
        db().collection('subtasks').where('topic_id', 'in', ch).get(),
        db().collection('progress_entries').where('topic_id', 'in', ch).get(),
      ]);
      for (const d of subs.docs) {
        const data = { id: d.id, ...(d.data() as any) };
        const arr = subtasksByTopic.get(data.topic_id);
        if (arr) arr.push(data); else subtasksByTopic.set(data.topic_id, [data]);
      }
      for (const d of ents.docs) {
        const data = { id: d.id, ...(d.data() as any) };
        const arr = entriesByTopic.get(data.topic_id);
        if (arr) arr.push(data); else entriesByTopic.set(data.topic_id, [data]);
      }
    }

    relevantTopics = relevantTopics.map((t) => ({
      ...t,
      subtasks: subtasksByTopic.get(t.id) || [],
      progress_entries: entriesByTopic.get(t.id) || [],
    }));

    const assigneesSnap = await db().collection('assignees').where('user_id', '==', schedule.user_id).get();
    let targetAssignees = assigneesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
    targetAssignees = targetAssignees.filter((a) => a.email);
    if (!schedule.send_to_all_assignees && schedule.selected_assignee_ids?.length > 0) {
      const sel = new Set<string>(schedule.selected_assignee_ids);
      targetAssignees = targetAssignees.filter((a) => sel.has(a.id));
    }

    for (const assignee of targetAssignees) {
      let assigneeTopics = relevantTopics.filter((t) => t.assignee === assignee.name);
      if (assigneeTopics.length === 0) continue;
      const updateToken = await getOrCreateUpdateToken({ userId: schedule.user_id, assigneeName: assignee.name });

      assigneeTopics.sort((a, b) => {
        if (a.execution_order != null && b.execution_order != null) return a.execution_order - b.execution_order;
        if (a.execution_order != null) return -1;
        if (b.execution_order != null) return 1;
        return 0;
      });

      const topicsWithPending = assigneeTopics.map((t, i) => {
        const pending = (t.subtasks || []).filter((s: any) => !s.completed);
        const sortedEntries = [...(t.progress_entries || [])].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const description = sortedEntries.find((e: any) => e.source !== 'assignee')?.content || '';
        return { ...t, pendingSubtasks: pending, num: i + 1, description };
      });

      const now = new Date(); now.setHours(0, 0, 0, 0);
      let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
      mensaje += `<p>Hola ${assignee.name},</p>`;
      mensaje += `<p>Tienes <strong>${assigneeTopics.length} tema${assigneeTopics.length > 1 ? 's' : ''}</strong> pendiente${assigneeTopics.length > 1 ? 's' : ''} de actualizar. <strong>Responde este correo</strong> con el estado de cada uno.</p>`;

      for (const t of topicsWithPending) {
        const pendingText = t.pendingSubtasks.length > 0 ? `${t.pendingSubtasks.length} subtarea${t.pendingSubtasks.length > 1 ? 's' : ''}` : 'Sin pendientes';
        const pendingColor = t.pendingSubtasks.length > 0 ? '#c0392b' : '#888';
        const overdue = t.due_date && new Date(t.due_date) < now;
        const cardBorder = overdue ? 'border-left:4px solid #c0392b;' : 'border-left:4px solid #3498db;';
        const titleColor = overdue ? 'color:#c0392b;' : 'color:#2c3e50;';

        mensaje += `<div style="margin:10px 0;padding:10px 14px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
        const orderBadge = t.execution_order != null
          ? `<span style="display:inline-block;background:#2563eb;color:#fff;border-radius:50%;width:24px;height:24px;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:6px;vertical-align:middle;">${t.execution_order}</span>`
          : '';
        mensaje += `<p style="margin:0 0 6px;font-size:14px;font-weight:700;${titleColor}">${orderBadge}${t.title}</p>`;
        if (t.description) {
          mensaje += `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:8px 10px;margin-bottom:8px;"><p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;">📌 Descripción</p><p style="margin:0;font-size:12px;color:#1e3a5f;white-space:pre-wrap;">${t.description}</p></div>`;
        }
        mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
        mensaje += `<tr><td style="padding:3px 0;color:#888;width:110px;">Inicio</td><td style="padding:3px 0;">${formatDate(t.start_date) || '—'}</td></tr>`;
        mensaje += `<tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${formatDate(t.due_date) || '—'}</td></tr>`;
        mensaje += `<tr><td style="padding:3px 0;color:#888;">Pendientes</td><td style="padding:3px 0;color:${pendingColor};">${pendingText}</td></tr>`;
        mensaje += `</table></div>`;
      }

      mensaje += `<p style="font-size:11px;color:#999;margin:4px 0 12px;">🔴 Las tarjetas con borde rojo indican temas con fecha vencida.</p>`;

      const withPending = topicsWithPending.filter((t) => t.pendingSubtasks.length > 0);
      if (withPending.length > 0) {
        mensaje += `<p style="margin-top:12px;"><strong>Subtareas pendientes:</strong></p>`;
        for (const t of withPending) {
          mensaje += `<p style="margin:8px 0 2px;"><strong>${t.num}. ${t.title}</strong></p><ul style="margin:0;padding-left:20px;">`;
          for (const s of t.pendingSubtasks as any[]) {
            mensaje += `<li style="margin-bottom:4px;">${s.title}`;
            if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
            mensaje += `</li>`;
          }
          mensaje += `</ul>`;
        }
      }

      mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
      if (updateToken) mensaje += `<div style="text-align:center;margin:16px 0;"><a href="${APP_URL}/update/${updateToken}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">📝 Actualizar mis temas</a></div>`;
      mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p><p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p><p style="font-size:11px;color:#aaa;">📧 Correo automático programado.</p></div>`;

      const asunto = `🚨 ${assigneeTopics.length} TEMA${assigneeTopics.length > 1 ? 'S' : ''} ACTIVO${assigneeTopics.length > 1 ? 'S' : ''} — ¡Actualizar a la brevedad! | Máx. 48 hrs para responder`;

      try {
        await sendEmail({ to: assignee.email, subject: asunto, html: mensaje });
        emailsSent++;
        const batch = db().batch();
        for (const topic of assigneeTopics) {
          batch.set(db().collection('notification_emails').doc(), {
            user_id: schedule.user_id,
            topic_id: topic.id,
            assignee_name: assignee.name,
            assignee_email: assignee.email,
            email_type: 'weekly',
            sent_at: new Date().toISOString(),
            responded: false,
            confirmed: false,
          });
        }
        await batch.commit();
      } catch (e) {
        console.error(`Error sending to ${assignee.email}:`, e);
      }
    }
  }
  return { success: true, emails_sent: emailsSent };
}

export const sendScheduledEmailsScheduled = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'America/Santiago' },
  async () => { await run(); },
);
export const sendScheduledEmails = onCall(async () => run());
