import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
}

type SubtaskWithEntries = Subtask & { subtask_entries: SubtaskEntry[] };

export interface ProgressEntry {
  id: string;
  topic_id: string;
  content: string;
  created_at: string;
}

export type TopicWithSubtasks = Topic & { subtasks: SubtaskWithEntries[]; progress_entries: ProgressEntry[] };

export function useTopics() {
  const queryClient = useQueryClient();

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: async (): Promise<TopicWithSubtasks[]> => {
      const [topicsRes, subtasksRes, entriesRes, subtaskEntriesRes] = await Promise.all([
        supabase.from('topics').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('subtasks').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('progress_entries').select('*').order('created_at', { ascending: true }),
        supabase.from('subtask_entries').select('*').order('created_at', { ascending: true }),
      ]);

      if (topicsRes.error) throw topicsRes.error;
      if (subtasksRes.error) throw subtasksRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (subtaskEntriesRes.error) throw subtaskEntriesRes.error;

      const subtasks = subtasksRes.data || [];
      const entries = entriesRes.data || [];
      const subtaskEntries = subtaskEntriesRes.data || [];

      // Build lookup map for subtask entries
      const entriesBySubtask = new Map<string, SubtaskEntry[]>();
      for (const e of subtaskEntries) {
        const arr = entriesBySubtask.get(e.subtask_id);
        if (arr) arr.push(e);
        else entriesBySubtask.set(e.subtask_id, [e]);
      }

      // Build lookup maps for O(n) instead of O(n*m)
      const subtasksByTopic = new Map<string, SubtaskWithEntries[]>();
      for (const s of subtasks) {
        const enriched: SubtaskWithEntries = { ...s, subtask_entries: entriesBySubtask.get(s.id) || [] };
        const arr = subtasksByTopic.get(s.topic_id);
        if (arr) arr.push(enriched);
        else subtasksByTopic.set(s.topic_id, [enriched]);
      }

      const entriesByTopic = new Map<string, ProgressEntry[]>();
      for (const e of entries) {
        const arr = entriesByTopic.get(e.topic_id);
        if (arr) arr.push(e);
        else entriesByTopic.set(e.topic_id, [e]);
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
    },
    onSettled: invalidateTopics,
  });

  const addProgressEntry = useMutation({
    mutationFn: async ({ topic_id, content }: { topic_id: string; content: string }) => {
      const { error } = await supabase.from('progress_entries').insert({ topic_id, content });
      if (error) throw error;
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
  };
}
