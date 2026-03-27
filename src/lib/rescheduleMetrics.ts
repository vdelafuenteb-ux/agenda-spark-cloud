import { differenceInDays } from 'date-fns';
import type { Reschedule } from '@/hooks/useReschedules';

interface TopicLike {
  id: string;
  start_date?: string | null;
  due_date?: string | null;
  closed_at?: string | null;
  status: string;
}

export interface RescheduleImpact {
  topicId: string;
  originalDuration: number; // days
  actualDuration: number; // days
  overtimeDays: number;
  overtimePct: number;
  rescheduleCount: number;
}

/**
 * For a single topic with reschedules, compute overtime impact.
 * Original due date = first reschedule's previous_date (the original deadline before any change).
 * Actual end = closed_at (if completed) or current due_date.
 */
export function computeTopicOvertime(
  topic: TopicLike,
  topicReschedules: Reschedule[],
): RescheduleImpact | null {
  if (topicReschedules.length === 0) return null;
  if (!topic.start_date) return null;

  // Sort by created_at asc to find the original date
  const sorted = [...topicReschedules].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const originalDueDate = sorted[0].previous_date;
  if (!originalDueDate) return null;

  const start = new Date(topic.start_date + 'T00:00:00');
  const originalEnd = new Date(originalDueDate + 'T23:59:59');
  const originalDuration = differenceInDays(originalEnd, start);
  if (originalDuration <= 0) return null;

  // Actual end: closed_at if completed, otherwise current due_date
  const actualEndStr =
    topic.status === 'completado' && topic.closed_at
      ? topic.closed_at.split('T')[0]
      : topic.due_date;
  if (!actualEndStr) return null;

  const actualEnd = new Date(actualEndStr + 'T23:59:59');
  const actualDuration = differenceInDays(actualEnd, start);
  if (actualDuration <= 0) return null;

  const overtimeDays = Math.max(0, actualDuration - originalDuration);
  const overtimePct = Math.round(((actualDuration / originalDuration) - 1) * 100);

  return {
    topicId: topic.id,
    originalDuration,
    actualDuration,
    overtimeDays,
    overtimePct: Math.max(0, overtimePct),
    rescheduleCount: topicReschedules.length,
  };
}

export interface GlobalRescheduleStats {
  avgReschedulesPerTopic: number;
  avgOvertimeDays: number;
  avgOvertimePct: number;
  topicsWithReschedules: number;
}

/**
 * Compute global averages across all topics that have reschedules.
 */
export function computeGlobalRescheduleStats(
  topics: TopicLike[],
  reschedules: Reschedule[],
): GlobalRescheduleStats {
  // Group reschedules by topic
  const byTopic = new Map<string, Reschedule[]>();
  for (const r of reschedules) {
    const arr = byTopic.get(r.topic_id);
    if (arr) arr.push(r);
    else byTopic.set(r.topic_id, [r]);
  }

  const impacts: RescheduleImpact[] = [];
  for (const [topicId, topicReschedules] of byTopic) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) continue;
    const impact = computeTopicOvertime(topic, topicReschedules);
    if (impact) impacts.push(impact);
  }

  const topicsWithReschedules = byTopic.size;
  const totalReschedules = reschedules.length;
  const avgReschedulesPerTopic = topicsWithReschedules > 0
    ? Math.round((totalReschedules / topicsWithReschedules) * 10) / 10
    : 0;

  const avgOvertimeDays = impacts.length > 0
    ? Math.round(impacts.reduce((s, i) => s + i.overtimeDays, 0) / impacts.length)
    : 0;

  const avgOvertimePct = impacts.length > 0
    ? Math.round(impacts.reduce((s, i) => s + i.overtimePct, 0) / impacts.length)
    : 0;

  return { avgReschedulesPerTopic, avgOvertimeDays, avgOvertimePct, topicsWithReschedules };
}

/** Format days as human-readable duration */
export function formatDuration(days: number): string {
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7 * 10) / 10;
  if (weeks < 5) return `${weeks} sem`;
  const months = Math.round(days / 30 * 10) / 10;
  return `${months} mes${months !== 1 ? 'es' : ''}`;
}
