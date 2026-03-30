import { isStoredDateOverdue } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';

const DEADLINE_HOURS = 48;

export interface ProductivityScoreResult {
  score: number | null;
  dimensions: { key: string; value: number; weight: number }[];
  redistributedWeights: Record<string, number>;
}

/**
 * Compute real-time productivity score for an assignee.
 * Uses the same logic as AssigneeProfileView.
 */
export function computeProductivityScore(
  assigneeName: string,
  topics: TopicWithSubtasks[],
  emailHistory: { confirmed?: boolean; confirmed_at?: string | null; sent_at: string; email_type?: string }[] = [],
): ProductivityScoreResult {
  const assigneeTopics = topics.filter(t => t.assignee === assigneeName);
  const active = assigneeTopics.filter(t => t.status === 'activo');
  const seguimiento = assigneeTopics.filter(t => t.status === 'seguimiento');
  const completed = assigneeTopics.filter(t => t.status === 'completado');
  const activeAndTracking = [...active, ...seguimiento];

  // --- Closure compliance ---
  const closedWithDates = completed.filter(t => t.due_date && t.closed_at);
  let closureOnTime = 0;
  for (const t of closedWithDates) {
    const closedDate = new Date(t.closed_at!);
    const dueDate = new Date(t.due_date! + 'T23:59:59');
    if (closedDate.getTime() <= dueDate.getTime()) closureOnTime++;
  }
  const closureComplianceRate = closedWithDates.length > 0
    ? Math.round((closureOnTime / closedWithDates.length) * 100) : null;

  // --- Subtask timeliness ---
  const allSubtasks = assigneeTopics.flatMap(t => t.subtasks);
  const completedSubtasks = allSubtasks.filter(s => s.completed);
  const completedWithDue = completedSubtasks.filter(s => s.due_date && s.completed_at);
  const subtasksOnTime = completedWithDue.filter(s => {
    const dueDate = new Date(s.due_date! + 'T23:59:59');
    const completedDate = new Date(s.completed_at!);
    return completedDate.getTime() <= dueDate.getTime();
  });
  const subtaskTimelinessRate = completedWithDue.length > 0
    ? Math.round((subtasksOnTime.length / completedWithDue.length) * 100) : null;

  // --- Email compliance (only weekly emails count for the 48h KPI) ---
  const weeklyEmails = emailHistory.filter(e => !e.email_type || e.email_type === 'weekly');
  const confirmedEmails = weeklyEmails.filter(e => e.confirmed && e.confirmed_at);
  const onTimeEmails = confirmedEmails.filter(e => {
    const deadlineTime = new Date(e.sent_at).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
    return new Date(e.confirmed_at!).getTime() <= deadlineTime;
  });
  const complianceRate = confirmedEmails.length > 0
    ? Math.round((onTimeEmails.length / confirmedEmails.length) * 100) : 0;

  // --- Deadline compliance (active) ---
  const activeWithDue = activeAndTracking.filter(t => t.due_date && !t.is_ongoing);
  const activeOnTime = activeWithDue.filter(t => !isStoredDateOverdue(t.due_date));
  const deadlineCompliance = activeWithDue.length > 0
    ? Math.round((activeOnTime.length / activeWithDue.length) * 100) : null;

  // --- Velocity ---
  const closedWithStartAndDue = completed.filter(t => t.start_date && t.due_date && t.closed_at);
  let velocityScore: number | null = null;
  if (closedWithStartAndDue.length > 0) {
    const pcts = closedWithStartAndDue.map(t => {
      const start = new Date(t.start_date!).getTime();
      const due = new Date(t.due_date! + 'T23:59:59').getTime();
      const closed = new Date(t.closed_at!).getTime();
      const totalTime = due - start;
      if (totalTime <= 0) return 100;
      const usedTime = closed - start;
      return Math.min(Math.round((usedTime / totalTime) * 100), 150);
    });
    const avgPctUsed = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    velocityScore = Math.max(0, Math.min(100, Math.round(100 - (avgPctUsed - 50) * (100 / 100))));
  }

  // --- Aggregate ---
  const dimensions: { key: string; value: number; weight: number }[] = [];
  if (closedWithDates.length > 0) dimensions.push({ key: 'closure', value: closureComplianceRate ?? 0, weight: 0.50 });
  if (confirmedEmails.length > 0) dimensions.push({ key: 'email', value: complianceRate, weight: 0.10 });
  if (completedWithDue.length > 0) dimensions.push({ key: 'subtask', value: subtaskTimelinessRate ?? 0, weight: 0.20 });
  if (deadlineCompliance !== null) dimensions.push({ key: 'deadline', value: deadlineCompliance, weight: 0.10 });
  if (velocityScore !== null) dimensions.push({ key: 'velocity', value: velocityScore, weight: 0.10 });

  let productivityScore: number | null = null;
  const redistributedWeights: Record<string, number> = {};
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  if (dimensions.length > 0) {
    productivityScore = Math.round(dimensions.reduce((s, d) => s + d.value * (d.weight / totalWeight), 0));
    const rawPcts = dimensions.map(d => ({ key: d.key, pct: (d.weight / totalWeight) * 100 }));
    const floored = rawPcts.map(p => ({ ...p, floor: Math.floor(p.pct), remainder: p.pct - Math.floor(p.pct) }));
    let remaining = 100 - floored.reduce((s, f) => s + f.floor, 0);
    floored.sort((a, b) => b.remainder - a.remainder);
    for (const f of floored) {
      const extra = remaining > 0 ? 1 : 0;
      redistributedWeights[f.key] = f.floor + extra;
      remaining -= extra;
    }
  }

  return { score: productivityScore, dimensions, redistributedWeights };
}
