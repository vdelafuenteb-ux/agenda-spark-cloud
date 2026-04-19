import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './_shared';

const DEADLINE_HOURS = 48;

function isOverdue(dateStr: string | null | undefined, today: string): boolean {
  if (!dateStr) return false;
  return dateStr < today;
}

interface ScoreResult {
  score: number;
  dimensions: Record<string, number>;
}

function calculateScore(topics: any[], subtasks: any[], emails: any[], assigneeName: string, todayStr: string): ScoreResult | null {
  const assigneeTopics = topics.filter((t) => t.assignee === assigneeName);
  if (assigneeTopics.length === 0) return null;

  const active = assigneeTopics.filter((t) => t.status === 'activo' || t.status === 'seguimiento');
  const completed = assigneeTopics.filter((t) => t.status === 'completado');

  const closedOngoing = completed.filter((t) => t.is_ongoing && t.closed_at);
  const closedWithDates = completed.filter((t) => !t.is_ongoing && t.due_date && t.closed_at);
  let closureOnTime = closedOngoing.length;
  for (const t of closedWithDates) {
    const closedDate = new Date(t.closed_at).getTime();
    const dueDate = new Date(t.due_date + 'T23:59:59').getTime();
    if (closedDate <= dueDate) closureOnTime++;
  }
  const closureTotal = closedOngoing.length + closedWithDates.length;
  const closureRate = closureTotal > 0 ? Math.round((closureOnTime / closureTotal) * 100) : null;

  const nonPausedTopicIds = new Set(assigneeTopics.filter((t) => t.status !== 'pausado').map((t) => t.id));
  const assigneeSubtasks = subtasks.filter((s) => nonPausedTopicIds.has(s.topic_id));
  const completedWithDue = assigneeSubtasks.filter((s) => s.completed && s.due_date && s.completed_at);
  const subtasksOnTime = completedWithDue.filter((s) => {
    const due = new Date(s.due_date + 'T23:59:59').getTime();
    const done = new Date(s.completed_at).getTime();
    return done <= due;
  });
  const subtaskRate = completedWithDue.length > 0 ? Math.round((subtasksOnTime.length / completedWithDue.length) * 100) : null;

  const assigneeEmails = emails.filter((e) => e.assignee_name === assigneeName && e.email_type === 'weekly');
  const confirmedEmails = assigneeEmails.filter((e) => e.confirmed && e.confirmed_at);
  const onTimeEmails = confirmedEmails.filter((e) => {
    const deadline = new Date(e.sent_at).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
    return new Date(e.confirmed_at).getTime() <= deadline;
  });
  const emailRate = confirmedEmails.length > 0 ? Math.round((onTimeEmails.length / confirmedEmails.length) * 100) : null;

  const activeWithDue = active.filter((t) => t.due_date && !t.is_ongoing);
  const activeOnTime = activeWithDue.filter((t) => !isOverdue(t.due_date, todayStr));
  const deadlineRate = activeWithDue.length > 0 ? Math.round((activeOnTime.length / activeWithDue.length) * 100) : null;

  const closedWithStartAndDue = completed.filter((t) => t.start_date && t.due_date && t.closed_at);
  let velocityScore: number | null = null;
  if (closedWithStartAndDue.length > 0) {
    const pcts = closedWithStartAndDue.map((t) => {
      const start = new Date(t.start_date).getTime();
      const due = new Date(t.due_date + 'T23:59:59').getTime();
      const closed = new Date(t.closed_at).getTime();
      const totalTime = due - start;
      if (totalTime <= 0) return 100;
      return Math.min(Math.round(((closed - start) / totalTime) * 100), 150);
    });
    const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    velocityScore = Math.max(0, Math.min(100, Math.round(100 - (avgPct - 50))));
  }

  const dims: { value: number; weight: number; name: string }[] = [];
  if (closureRate !== null) dims.push({ value: closureRate, weight: 0.50, name: 'cierre_temas' });
  if (subtaskRate !== null) dims.push({ value: subtaskRate, weight: 0.20, name: 'puntualidad_subtareas' });
  if (emailRate !== null) dims.push({ value: emailRate, weight: 0.10, name: 'respuesta_correos' });
  if (deadlineRate !== null) dims.push({ value: deadlineRate, weight: 0.10, name: 'plazos_activos' });
  if (velocityScore !== null) dims.push({ value: velocityScore, weight: 0.10, name: 'velocidad' });
  if (dims.length === 0) return null;

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const score = Math.round(dims.reduce((s, d) => s + d.value * (d.weight / totalWeight), 0));
  const dimRecord: Record<string, number> = {};
  for (const d of dims) dimRecord[d.name] = d.value;
  return { score, dimensions: dimRecord };
}

async function run(): Promise<{ saved: number; errors: string[]; date: string }> {
  const todayStr = new Date().toISOString().split('T')[0];

  const assigneesSnap = await db().collection('assignees').get();
  const assignees = assigneesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  if (assignees.length === 0) return { saved: 0, errors: [], date: todayStr };

  const userIds = [...new Set(assignees.map((a: any) => a.user_id))];
  // Chunk user_ids for Firestore `in` (limit 30).
  async function fetchByUserIds(coll: string): Promise<any[]> {
    const out: any[] = [];
    for (let i = 0; i < userIds.length; i += 30) {
      const chunk = userIds.slice(i, i + 30);
      const s = await db().collection(coll).where('user_id', 'in', chunk).get();
      out.push(...s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    return out;
  }
  const [topics, subtasksAll, emails] = await Promise.all([
    fetchByUserIds('topics'),
    db().collection('subtasks').get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    fetchByUserIds('notification_emails'),
  ]);

  let saved = 0;
  const errors: string[] = [];
  for (const a of assignees as any[]) {
    const userTopics = topics.filter((t) => t.user_id === a.user_id);
    const userEmails = emails.filter((e) => e.user_id === a.user_id);
    const result = calculateScore(userTopics, subtasksAll, userEmails, a.name, todayStr);
    if (!result) continue;
    const docId = `${a.user_id}_${a.name}_${todayStr}`;
    try {
      await db().collection('score_snapshots').doc(docId).set({
        user_id: a.user_id,
        assignee_name: a.name,
        score: result.score,
        dimensions: result.dimensions,
        snapshot_date: todayStr,
        updated_at: new Date().toISOString(),
      }, { merge: true });
      saved++;
    } catch (e: any) {
      errors.push(`${a.name}: ${e.message}`);
    }
  }
  return { saved, errors, date: todayStr };
}

export const saveScoreSnapshotsScheduled = onSchedule(
  { schedule: 'every day 07:00', timeZone: 'America/Santiago' },
  async () => { await run(); },
);

export const saveScoreSnapshots = onCall(async () => run());
