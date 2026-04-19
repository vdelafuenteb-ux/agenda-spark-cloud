import { onCall } from 'firebase-functions/v2/https';
import { chileDate, db, getUserEmail, sendEmail } from './_shared';

export const sendReminderEmail = onCall(async (request) => {
  const body = (request.data ?? {}) as { test?: boolean; reminder_id?: string };
  const testMode = body.test === true;

  let reminders: Array<Record<string, any>> = [];
  if (testMode && body.reminder_id) {
    const snap = await db().collection('reminder_emails').doc(body.reminder_id).get();
    if (!snap.exists) throw new Error('Reminder not found');
    reminders = [{ id: snap.id, ...snap.data() }];
  } else {
    const { day, hour } = chileDate();
    const snap = await db()
      .collection('reminder_emails')
      .where('enabled', '==', true)
      .where('day_of_week', '==', day)
      .where('send_hour', '==', hour)
      .get();
    reminders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (reminders.length === 0) return { success: true, message: 'No reminders to send' };

  let emailsSent = 0;
  for (const reminder of reminders) {
    const recipients: string[] = reminder.recipient_emails || [];
    if (recipients.length === 0) continue;
    const ccEmail = (await getUserEmail(reminder.user_id)) || '';
    const subject = reminder.subject || 'Recordatorio semanal';
    for (const recipientEmail of recipients) {
      const htmlBody = `
        <div style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#0f172a 0%,#1e40af 50%,#3b82f6 100%);padding:40px 36px 32px;text-align:center;">
            <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;"><span style="font-size:28px;line-height:56px;">📋</span></div>
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${subject}</h1>
          </div>
          <div style="padding:36px 36px 28px;">
            <div style="background:linear-gradient(135deg,#eff6ff,#f0f9ff);border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:24px 28px;margin-bottom:28px;">
              <p style="font-size:15px;color:#1e293b;line-height:1.8;margin:0;white-space:pre-line;">${(reminder.message || '').replace(/\n/g, '<br/>')}</p>
            </div>
            <div style="text-align:center;margin:24px 0;"><span style="display:inline-block;width:40px;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:2px;"></span></div>
            <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;line-height:1.6;">Correo generado automáticamente · Sistema de Gestión</p>
          </div>
        </div>`;
      try {
        await sendEmail({ to: recipientEmail, subject: `📋 ${subject}`, html: htmlBody, cc: ccEmail ? [ccEmail] : [] });
        emailsSent++;
      } catch (e) {
        console.error(`[send-reminder-email] error for ${recipientEmail}:`, e);
      }
    }
  }
  return { success: true, emails_sent: emailsSent };
});
