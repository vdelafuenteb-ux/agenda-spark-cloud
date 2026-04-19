// Cloud Functions entry point — ports of supabase/functions/*.
// Exported names are in camelCase; the frontend adapter at
// src/integrations/supabase/client.ts converts kebab-case
// `supabase.functions.invoke('send-x')` calls into camelCase.

import * as admin from 'firebase-admin';
admin.initializeApp();

export { sendNotificationEmail } from './send-notification-email';
export { sendBulkNotification } from './send-bulk-notification';
export { sendNewTopicNotification } from './send-new-topic-notification';
export { sendTopicClosedNotification } from './send-topic-closed-notification';
export { sendIncidentNotification } from './send-incident-notification';
export { sendReminderEmail } from './send-reminder-email';
export { sendTopicReminders, sendTopicRemindersScheduled } from './send-topic-reminders';
export { markEmailResponded } from './mark-email-responded';
export { validateUpdateToken } from './validate-update-token';
export { submitUpdate } from './submit-update';
export { saveScoreSnapshots, saveScoreSnapshotsScheduled } from './save-score-snapshots';
export { sendDailySummary, sendDailySummaryScheduled } from './send-daily-summary';
export { sendScheduledEmails, sendScheduledEmailsScheduled } from './send-scheduled-emails';
export { testEmail } from './test-email';
