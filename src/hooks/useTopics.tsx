import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logEvent } from '@/features/workGraph/events';
import type { Database } from '@/integrations/supabase/types';

// Firestore `in` operator supports at most 30 values — split larger sets.
async function inChunks<T>(ids: string[], fetcher: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 30) out.push(...(await fetcher(ids.slice(i, i + 30))));
  return out;
}

type Topic = Database['public']['Tables']['topics']['Row'];
type TopicInsert = Database['public']['Tables']['topics']['Insert'];
type TopicUpdate = Database['public']['Tables']['topics']['Update'];
type Subtask = Database['public']['Tables']['subtasks']['Row'];

export interface SubtaskEntry {
  id: string;
  subtask_id: string;
  content: string;
  created_at: string;
  attachments: EntryAttachment[];
}

export interface SubtaskContact {
  id: string;
  subtask_id: string;
  name: string;
  email: string;
  sort_order: number;
  created_at: string;
}

type SubtaskWithEntries = Subtask & { subtask_entries: SubtaskEntry[]; subtask_contacts: SubtaskContact[] };

export interface EntryAttachment {
  id: string;
  entry_id: string;
  entry_type: 'progress' | 'subtask';
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface ProgressEntry {
  id: string;
  topic_id: string;
  content: string;
  created_at: string;
  source?: string;
  attachments: EntryAttachment[];
}

export type TopicWithSubtasks = Topic & { subtasks: SubtaskWithEntries[]; progress_entries: ProgressEntry[] };

export function useTopics(workspaceId?: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const topicsQuery = useQuery({
    queryKey: ['topics', workspaceId ?? null],
    enabled: !!workspaceId,
    queryFn: async (): Promise<TopicWithSubtasks[]> => {
      if (!workspaceId) return [];
      const topicsRes = await supabase.from('topics').select('*').eq('workspace_id', workspaceId);
      if (topicsRes.error) throw topicsRes.error;
      const topics = (topicsRes.data || []) as any[];
      topics.sort((a, b) => {
        const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (so !== 0) return so;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const topicIds = topics.map((t) => t.id);
      const [subtasksRaw, entriesRaw] = await Promise.all([
        inChunks<any>(topicIds, async (chunk) => {
          const r = await supabase.from('subtasks').select('*').in('topic_id', chunk);
          if (r.error) throw r.error;
          return r.data as any[];
        }),
        inChunks<any>(topicIds, async (chunk) => {
          const r = await supabase.from('progress_entries').select('*').in('topic_id', chunk);
          if (r.error) throw r.error;
          return r.data as any[];
        }),
      ]);
      const subtaskIds = subtasksRaw.map((s) => s.id);
      const entryIds = entriesRaw.map((e) => e.id);
      const [subtaskEntriesRaw, contactsRaw, attachmentsRaw] = await Promise.all([
        inChunks<any>(subtaskIds, async (chunk) => {
          const r = await supabase.from('subtask_entries').select('*').in('subtask_id', chunk);
          if (r.error) throw r.error;
          return r.data as any[];
        }),
        inChunks<any>(subtaskIds, async (chunk) => {
          const r = await supabase.from('subtask_contacts').select('*').in('subtask_id', chunk);
          if (r.error) throw r.error;
          return r.data as any[];
        }),
        inChunks<any>([...entryIds, ...subtaskIds], async (chunk) => {
          const r = await supabase.from('entry_attachments').select('*').in('entry_id', chunk);
          if (r.error) throw r.error;
          return r.data as any[];
        }),
      ]);

      const subtasks = [...subtasksRaw].sort((a, b) => {
        const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (so !== 0) return so;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      const entries = [...entriesRaw].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const subtaskEntries = [...subtaskEntriesRaw].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const contacts = [...contactsRaw].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) as unknown as SubtaskContact[];
      const attachments = attachmentsRaw as unknown as EntryAttachment[];

      // Build lookup map for attachments by entry_id
      const attachmentsByEntry = new Map<string, EntryAttachment[]>();
      for (const a of attachments) {
        const arr = attachmentsByEntry.get(a.entry_id);
        if (arr) arr.push(a);
        else attachmentsByEntry.set(a.entry_id, [a]);
      }

      // Build lookup map for subtask entries
      const entriesBySubtask = new Map<string, SubtaskEntry[]>();
      for (const e of subtaskEntries) {
        const enriched: SubtaskEntry = { ...e, attachments: attachmentsByEntry.get(e.id) || [] };
        const arr = entriesBySubtask.get(e.subtask_id);
        if (arr) arr.push(enriched);
        else entriesBySubtask.set(e.subtask_id, [enriched]);
      }

      // Build lookup map for subtask contacts
      const contactsBySubtask = new Map<string, SubtaskContact[]>();
      for (const c of contacts) {
        const arr = contactsBySubtask.get(c.subtask_id);
        if (arr) arr.push(c);
        else contactsBySubtask.set(c.subtask_id, [c]);
      }

      // Build lookup maps for O(n) instead of O(n*m)
      const subtasksByTopic = new Map<string, SubtaskWithEntries[]>();
      for (const s of subtasks) {
        const enriched: SubtaskWithEntries = { ...s, subtask_entries: entriesBySubtask.get(s.id) || [], subtask_contacts: contactsBySubtask.get(s.id) || [] };
        const arr = subtasksByTopic.get(s.topic_id);
        if (arr) arr.push(enriched);
        else subtasksByTopic.set(s.topic_id, [enriched]);
      }

      const entriesByTopic = new Map<string, ProgressEntry[]>();
      for (const e of entries) {
        const enriched: ProgressEntry = { ...e, attachments: attachmentsByEntry.get(e.id) || [] };
        const arr = entriesByTopic.get(e.topic_id);
        if (arr) arr.push(enriched);
        else entriesByTopic.set(e.topic_id, [enriched]);
      }

      return topics.map((topic) => ({
        ...topic,
        subtasks: subtasksByTopic.get(topic.id) || [],
        progress_entries: entriesByTopic.get(topic.id) || [],
      })) as TopicWithSubtasks[];
    },
  });

  const invalidateTopics = () => queryClient.invalidateQueries({ queryKey: ['topics'] });

  const createTopic = useMutation({
    mutationFn: async (data: Omit<TopicInsert, 'user_id'> & { user_id: string }) => {
      const { data: created, error } = await supabase
        .from('topics')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      // Fire-and-forget event for the WorkGraph timeline. Never blocks creation.
      logEvent({
        type: 'task.created',
        workspace_id: (data as any).workspace_id ?? null,
        actor_id: user?.id ?? null,
        actor_email: user?.email ?? null,
        target_id: created?.id ?? null,
        target_type: 'task',
        payload: { title: (data as any).title, assignee: (data as any).assignee, status: (data as any).status, due_date: (data as any).due_date },
      });
      if ((data as any).assignee) {
        logEvent({
          type: 'task.assigned',
          workspace_id: (data as any).workspace_id ?? null,
          actor_id: user?.id ?? null,
          target_id: created?.id ?? null,
          target_type: 'task',
          payload: { assignee: (data as any).assignee },
        });
      }
      return created;
    },
  });

  const updateTopic = useMutation({
    mutationFn: async ({ id, ...data }: TopicUpdate & { id: string }) => {
      const { error } = await supabase.from('topics').update(data).eq('id', id);
      if (error) throw error;
      // Status transitions → fire specific lifecycle events so the NodeInspector
      // history is useful. We don't read the previous state from the cache
      // (could be stale); the status alone gives enough signal for a timeline.
      const statusPatch = (data as any).status as string | undefined;
      if (statusPatch) {
        const type =
          statusPatch === 'completado' ? 'task.completed'
          : statusPatch === 'pausado' ? 'task.blocked'
          : statusPatch === 'activo' ? 'task.unblocked'
          : 'task.updated';
        logEvent({
          type: type as any,
          workspace_id: null,
          actor_id: user?.id ?? null,
          actor_email: user?.email ?? null,
          target_id: id,
          target_type: 'task',
          payload: { status: statusPatch },
        });
      } else {
        // Non-status edits: still emit a generic event so the activity log fills.
        logEvent({
          type: 'task.updated' as any,
          workspace_id: null,
          actor_id: user?.id ?? null,
          target_id: id,
          target_type: 'task',
          payload: data as any,
        });
      }
      // Assignee change → task.assigned event.
      if ((data as any).assignee !== undefined) {
        logEvent({
          type: 'task.assigned',
          workspace_id: null,
          actor_id: user?.id ?? null,
          target_id: id,
          target_type: 'task',
          payload: { assignee: (data as any).assignee },
        });
      }
    },
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previous = queryClient.getQueryData<TopicWithSubtasks[]>(['topics']);
      queryClient.setQueryData<TopicWithSubtasks[]>(['topics'], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, ...data } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['topics'], ctx.previous);
      toast.error('Error al guardar los cambios del tema');
    },
    onSettled: invalidateTopics,
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('topics').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previous = queryClient.getQueryData<TopicWithSubtasks[]>(['topics']);
      queryClient.setQueryData<TopicWithSubtasks[]>(['topics'], (old = []) =>
        old.filter((t) => t.id !== id),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['topics'], ctx.previous);
      toast.error('Error al eliminar el tema');
    },
    onSettled: invalidateTopics,
  });

  const addSubtask = useMutation({
    mutationFn: async ({ topic_id, title }: { topic_id: string; title: string }) => {
      const { data, error } = await supabase.from('subtasks').insert({ topic_id, title }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateTopics,
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('subtasks').update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
      logEvent({
        type: completed ? 'task.completed' : 'task.started',
        workspace_id: null,
        actor_id: user?.id ?? null,
        target_id: id,
        target_type: 'subtask',
      });
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previous = queryClient.getQueryData<TopicWithSubtasks[]>(['topics']);
      queryClient.setQueryData<TopicWithSubtasks[]>(['topics'], (old = []) =>
        old.map((t) => ({
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === id ? { ...s, completed, completed_at: completed ? new Date().toISOString() : null } : s,
          ),
        })),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['topics'], ctx.previous);
      toast.error('Error al actualizar la subtarea');
    },
    onSettled: invalidateTopics,
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subtasks').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previous = queryClient.getQueryData<TopicWithSubtasks[]>(['topics']);
      queryClient.setQueryData<TopicWithSubtasks[]>(['topics'], (old = []) =>
        old.map((t) => ({
          ...t,
          subtasks: t.subtasks.filter((s) => s.id !== id),
        })),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['topics'], ctx.previous);
      toast.error('Error al eliminar la subtarea');
    },
    onSettled: invalidateTopics,
  });

  const addProgressEntry = useMutation({
    mutationFn: async ({ topic_id, content }: { topic_id: string; content: string }) => {
      const { data, error } = await supabase.from('progress_entries').insert({ topic_id, content }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidateTopics,
  });

  const updateProgressEntry = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from('progress_entries').update({ content }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  const deleteProgressEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('progress_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  const updateSubtask = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('subtasks').update(data).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previous = queryClient.getQueryData<TopicWithSubtasks[]>(['topics']);
      queryClient.setQueryData<TopicWithSubtasks[]>(['topics'], (old = []) =>
        old.map((t) => ({
          ...t,
          subtasks: t.subtasks.map((s) => (s.id === id ? { ...s, ...data } : s)),
        })),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['topics'], ctx.previous);
      toast.error('Error al actualizar la subtarea');
    },
    onSettled: invalidateTopics,
  });

  const addSubtaskEntry = useMutation({
    mutationFn: async ({ subtask_id, content }: { subtask_id: string; content: string }) => {
      const { data, error } = await supabase.from('subtask_entries').insert({ subtask_id, content }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidateTopics,
  });

  const updateSubtaskEntry = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from('subtask_entries').update({ content }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  const deleteSubtaskEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subtask_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  const addSubtaskContact = useMutation({
    mutationFn: async ({ subtask_id, name, email }: { subtask_id: string; name: string; email: string }) => {
      const { data, error } = await supabase.from('subtask_contacts').insert({ subtask_id, name, email } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateTopics,
  });

  const updateSubtaskContact = useMutation({
    mutationFn: async ({ id, name, email }: { id: string; name?: string; email?: string }) => {
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      const { error } = await supabase.from('subtask_contacts').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  const deleteSubtaskContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subtask_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  const uploadEntryAttachment = useMutation({
    mutationFn: async ({ entryId, entryType, file, userId }: { entryId: string; entryType: 'progress' | 'subtask'; file: File; userId: string }) => {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('progress-attachments').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('progress-attachments').getPublicUrl(path);
      const { error } = await supabase.from('entry_attachments').insert({
        entry_id: entryId,
        entry_type: entryType,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  const deleteEntryAttachment = useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl: string }) => {
      // Extract storage path from URL
      const pathMatch = fileUrl.match(/progress-attachments\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from('progress-attachments').remove([pathMatch[1]]);
      }
      const { error } = await supabase.from('entry_attachments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateTopics,
  });

  return {
    topics: topicsQuery.data || [],
    isLoading: topicsQuery.isLoading,
    error: topicsQuery.error,
    createTopic,
    updateTopic,
    deleteTopic,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addProgressEntry,
    updateProgressEntry,
    deleteProgressEntry,
    updateSubtask,
    addSubtaskEntry,
    updateSubtaskEntry,
    deleteSubtaskEntry,
    addSubtaskContact,
    updateSubtaskContact,
    deleteSubtaskContact,
    uploadEntryAttachment,
    deleteEntryAttachment,
  };
}
