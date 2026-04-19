import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { db } from './_shared';

// Public callable — email recipient opens the app with a token and calls this
// to resolve their pending topics. No auth required; the token itself is
// the capability.
export const validateUpdateToken = onCall({ invoker: 'public' }, async (request) => {
  const { token } = (request.data ?? {}) as { token?: string };
  if (!token || typeof token !== 'string') throw new HttpsError('invalid-argument', 'Token requerido');

  const tokDoc = await db().collection('update_tokens').doc(token).get();
  if (!tokDoc.exists) throw new HttpsError('not-found', 'Token inválido o no encontrado');
  const tokenData = tokDoc.data() as any;

  if (tokenData.used) throw new HttpsError('failed-precondition', 'Ya enviaste tu actualización. Recibirás un nuevo link en el próximo correo.');
  if (new Date(tokenData.expires_at) < new Date()) throw new HttpsError('failed-precondition', 'Token expirado. Solicita un nuevo correo.');

  let ownerName = 'Administrador';
  try {
    const u = await admin.auth().getUser(tokenData.user_id);
    const meta = u.customClaims as any;
    ownerName = meta?.full_name || meta?.name || u.displayName || u.email?.split('@')[0] || 'Administrador';
  } catch { /* fallback */ }

  // Topics for this user+assignee with active/seguimiento status (optionally filtered by topic_id)
  let q = db()
    .collection('topics')
    .where('user_id', '==', tokenData.user_id)
    .where('assignee', '==', tokenData.assignee_name)
    .where('status', 'in', ['activo', 'seguimiento']);
  const topicsSnap = await q.get();
  let topics = topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  if (tokenData.topic_id) topics = topics.filter((t) => t.id === tokenData.topic_id);

  const topicIds = topics.map((t) => t.id);
  let subtasks: any[] = [];
  let progressEntries: any[] = [];

  if (topicIds.length > 0) {
    // Firestore `in` supports up to 30 — chunk if needed.
    const chunks: string[][] = [];
    for (let i = 0; i < topicIds.length; i += 30) chunks.push(topicIds.slice(i, i + 30));
    for (const ch of chunks) {
      const [subsSnap, entriesSnap] = await Promise.all([
        db().collection('subtasks').where('topic_id', 'in', ch).get(),
        db().collection('progress_entries').where('topic_id', 'in', ch).get(),
      ]);
      subtasks.push(...subsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      progressEntries.push(...entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
  }

  subtasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  progressEntries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const result = topics.map((t: any) => {
    const topicEntries = progressEntries.filter((e) => e.topic_id === t.id);
    const descriptionEntry = topicEntries.find((e) => e.source !== 'assignee');
    const allEntries = topicEntries.filter((e) => e !== descriptionEntry);
    allEntries.reverse();
    return {
      ...t,
      subtasks: subtasks.filter((s) => s.topic_id === t.id),
      description: descriptionEntry ? { content: descriptionEntry.content, created_at: descriptionEntry.created_at } : null,
      recent_entries: allEntries,
    };
  });

  return {
    assignee_name: tokenData.assignee_name,
    owner_name: ownerName,
    topics: result,
  };
});
