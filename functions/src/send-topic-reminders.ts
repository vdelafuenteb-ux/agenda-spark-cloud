import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { chileDate, db, getUserEmail, sendEmail } from './_shared';

async function runSendTopicReminders(): Promise<{ success: boolean; sent: number }> {
  const { dateStr: todayStr } = chileDate();
  const snap = await db()
    .collection('topic_reminders')
    .where('reminder_date', '==', todayStr)
    .where('sent', '==', false)
    .get();
  if (snap.empty) return { success: true, sent: 0 };

  let emailsSent = 0;
  for (const rem of snap.docs) {
    const reminder = rem.data();
    if (!reminder.topic_id) continue;
    const topicDoc = await db().collection('topics').doc(reminder.topic_id).get();
    if (!topicDoc.exists) continue;
    const topic = topicDoc.data() as any;
    const userEmail = (await getUserEmail(reminder.user_id)) || 'matias@transitglobalgroup.com';
    const noteText = reminder.note ? `<p style="color:#555;font-size:13px;">📝 ${reminder.note}</p>` : '';
    const mensaje = `
      <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">
        <p>Hola,</p>
        <p>Este es un <strong>recordatorio programado</strong> para revisar el siguiente tema:</p>
        <div style="margin:12px 0;padding:12px 16px;background:#f8f9fa;border-radius:6px;border-left:4px solid #f59e0b;">
          <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#2c3e50;">${topic.title}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:3px 0;color:#888;width:110px;">Estado</td><td style="padding:3px 0;">${topic.status}</td></tr>
            <tr><td style="padding:3px 0;color:#888;">Responsable</td><td style="padding:3px 0;">${topic.assignee || '—'}</td></tr>
            <tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${topic.due_date || 'Sin fecha'}</td></tr>
          </table>
          ${noteText}
        </div>
        <p style="font-size:12px;color:#888;">Este recordatorio fue programado por ti en el sistema de gestión.</p>
      </div>`;

    try {
      await sendEmail({ to: userEmail, subject: `🔔 Recordatorio: ${topic.title}`, html: mensaje, cc: [] });
      await rem.ref.update({ sent: true });
      emailsSent++;
    } catch (e) {
      console.error(`Failed to send reminder ${rem.id}:`, e);
    }
  }
  return { success: true, sent: emailsSent };
}

// Daily scheduled trigger (runs hourly — cheap enough; the query filters to today + unsent)
export const sendTopicRemindersScheduled = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'America/Santiago' },
  async () => {
    await runSendTopicReminders();
  },
);

// Manual/callable version for admin testing.
export const sendTopicReminders = onCall(async () => runSendTopicReminders());
