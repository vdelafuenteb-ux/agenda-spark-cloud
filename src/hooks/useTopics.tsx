import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

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

export function useTopics() {
  const queryClient = useQueryClient();

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: async (): Promise<TopicWithSubtasks[]> => {
      const [topicsRes, subtasksRes, entriesRes, subtaskEntriesRes, contactsRes, attachmentsRes] = await Promise.all([
        supabase.from('topics').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('subtasks').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('progress_entries').select('*').order('created_at', { ascending: true }),
        supabase.from('subtask_entries').select('*').order('created_at', { ascending: true }),
        supabase.from('subtask_contacts').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('entry_attachments').select('*').order('created_at', { ascending: true }),
      ]);

      if (topicsRes.error) throw topicsRes.error;
      if (subtasksRes.error) throw subtasksRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (subtaskEntriesRes.error) throw subtaskEntriesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (attachmentsRes.error) throw attachmentsRes.error;

      const subtasks = subtasksRes.data || [];
      const entries = entriesRes.data || [];
      const subtaskEntries = subtaskEntriesRes.data || [];
      const contacts = (contactsRes.data || []) as unknown as SubtaskContact[];
      const attachments = (attachmentsRes.data || []) as unknown as EntryAttachment[];

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

      return (topicsRes.data || []).map((topic) => ({
        ...topic,
        subtasks: subtasksByTopic.get(topic.id) || [],
        progress_entries: entriesByTopic.get(topic.id) || [],
      }));
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
      return created;
    },
  });

  const updateTopic = useMutation({
    mutationFn: async ({ id, ...data }: TopicUpdate & { id: string }) => {
      const { error } = await supabase.from('topics').update(data).eq('id', id);
      if (error) throw error;
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
