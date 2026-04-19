import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '@/integrations/firebase/config';

// Event types match the spec: every meaningful state change emits an event so
// the graph can be reconstructed historically. Derived-state graphs are v1;
// event-sourced timelines are v2. See TimelineSlider.
export type WorkEventType =
  | 'task.created'
  | 'task.assigned'
  | 'task.started'
  | 'task.updated'
  | 'task.due_date_changed'
  | 'task.completed'
  | 'task.overdue'
  | 'task.comment_added'
  | 'task.email_sent'
  | 'task.email_replied'
  | 'task.help_requested'
  | 'task.blocked'
  | 'task.unblocked'
  | 'task.escalated'
  | 'task.reviewed'
  | 'task.approved'
  | 'task.rejected'
  | 'response.on_time'
  | 'response.late'
  | 'dependency.added'
  | 'evidence.added'
  | 'collaboration.created'
  | 'score.updated'
  | 'workspace.created'
  | 'workspace.deleted'
  | 'assignee.created'
  | 'assignee.deleted';

export interface WorkEvent {
  id?: string;
  type: WorkEventType;
  workspace_id: string | null;
  actor_id?: string | null;
  actor_email?: string | null;
  target_id?: string | null;
  target_type?: string | null;
  payload?: Record<string, unknown>;
  created_at: string;
}

/**
 * Fire-and-forget event logger. Failures are logged but never block the calling
 * mutation — the event layer is an observability concern, not a source of truth.
 */
export async function logEvent(event: Omit<WorkEvent, 'created_at'> & { created_at?: string }): Promise<void> {
  try {
    await addDoc(collection(firestore, 'workspace_events'), {
      ...event,
      created_at: event.created_at ?? new Date().toISOString(),
    });
  } catch (e) {
    // Silent by design — surface only in dev console.
    console.warn('[logEvent] failed:', e);
  }
}
