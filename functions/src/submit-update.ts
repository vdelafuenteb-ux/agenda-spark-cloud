import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './_shared';

export const submitUpdate = onCall({ invoker: 'public' }, async (request) => {
  const { token, updates } = (request.data ?? {}) as {
    token?: string;
    updates?: Array<{ topic_id: string; comment?: string; subtask_toggles?: Array<{ id: string; completed: boolean }> }>;
  };
  if (!token || typeof token !== 'string') throw new HttpsError('invalid-argument', 'Token requerido');
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    throw new HttpsError('invalid-argument', 'No hay actualizaciones para enviar');
  }

  const tokDoc = await db().collection('update_tokens').doc(token).get();
  if (!tokDoc.exists) throw new HttpsError('not-found', 'Token inválido');
  const tokenData = tokDoc.data() as any;

  if (tokenData.used) throw new HttpsError('failed-precondition', 'Ya enviaste tu actualización. Recibirás un nuevo link en el próximo correo.');
  if (new Date(tokenData.expires_at) < new Date()) throw new HttpsError('failed-precondition', 'Token expirado');

  // Get valid topic IDs for this assignee
  const topicsSnap = await db()
    .collection('topics')
    .where('user_id', '==', tokenData.user_id)
    .where('assignee', '==', tokenData.assignee_name)
    .where('status', '!=', 'completado')
    .get();
  const validTopicIds = new Set(topicsSnap.docs.map((d) => d.id));

  let commentsAdded = 0;
  let subtasksToggled = 0;

  for (const update of updates) {
    if (!validTopicIds.has(update.topic_id)) continue;

    if (update.comment && typeof update.comment === 'string' && update.comment.trim()) {
      const ref = db().collection('progress_entries').doc();
      await ref.set({
        topic_id: update.topic_id,
        content: update.comment.trim(),
        source: 'assignee',
        created_at: new Date().toISOString(),
      });
      commentsAdded++;
    }

    if (update.subtask_toggles && Array.isArray(update.subtask_toggles)) {
      for (const t of update.subtask_toggles) {
        if (!t.id || typeof t.completed !== 'boolean') continue;
        const subDoc = await db().collection('subtasks').doc(t.id).get();
        if (!subDoc.exists) continue;
        const sub = subDoc.data() as any;
        if (sub.topic_id !== update.topic_id) continue;
        await subDoc.ref.update({
          completed: t.completed,
          completed_at: t.completed ? new Date().toISOString() : null,
        });
        subtasksToggled++;
      }
    }
  }

  if (commentsAdded > 0 || subtasksToggled > 0) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const pendSnap = await db()
      .collection('notification_emails')
      .where('user_id', '==', tokenData.user_id)
      .where('assignee_name', '==', tokenData.assignee_name)
      .where('confirmed', '==', false)
      .where('sent_at', '>=', sevenDaysAgo.toISOString())
      .get();
    const batch = db().batch();
    const nowIso = new Date().toISOString();
    for (const d of pendSnap.docs) {
      batch.update(d.ref, {
        responded: true,
        responded_at: nowIso,
        confirmed: true,
        confirmed_at: nowIso,
      });
    }
    await batch.commit();
  }

  await tokDoc.ref.update({ used: true });
  return { success: true, comments_added: commentsAdded, subtasks_toggled: subtasksToggled };
});
