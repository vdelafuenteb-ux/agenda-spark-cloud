import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Topic = Database['public']['Tables']['topics']['Row'];
type TopicInsert = Database['public']['Tables']['topics']['Insert'];
type TopicUpdate = Database['public']['Tables']['topics']['Update'];
type Subtask = Database['public']['Tables']['subtasks']['Row'];

export interface ProgressEntry {
  id: string;
  topic_id: string;
  content: string;
  created_at: string;
}

export type TopicWithSubtasks = Topic & { subtasks: Subtask[]; progress_entries: ProgressEntry[] };

export function useTopics() {
  const queryClient = useQueryClient();

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: async (): Promise<TopicWithSubtasks[]> => {
      const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: subtasks, error: subError } = await supabase
        .from('subtasks')
        .select('*')
        .order('sort_order', { ascending: true });

      if (subError) throw subError;

      const { data: entries, error: entError } = await supabase
        .from('progress_entries')
        .select('*')
        .order('created_at', { ascending: true });

      if (entError) throw entError;

      return (topics || []).map((topic) => ({
        ...topic,
        subtasks: (subtasks || []).filter((subtask) => subtask.topic_id === topic.id),
        progress_entries: (entries || []).filter((entry) => entry.topic_id === topic.id),
      }));
    },
  });

  const createTopic = useMutation({
    mutationFn: async (data: Omit<TopicInsert, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: created, error } = await supabase
        .from('topics')
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
  });

  const updateTopic = useMutation({
    mutationFn: async ({ id, ...data }: TopicUpdate & { id: string }) => {
      const { error } = await supabase.from('topics').update(data).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previousTopics = queryClient.getQueryData<TopicWithSubtasks[]>(['topics']);
      queryClient.setQueryData<TopicWithSubtasks[]>(['topics'], (old = []) =>
        old.map((topic) => (topic.id === id ? { ...topic, ...data } : topic)),
      );
      return { previousTopics };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTopics) {
        queryClient.setQueryData(['topics'], context.previousTopics);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('topics').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
  });

  const addSubtask = useMutation({
    mutationFn: async ({ topic_id, title }: { topic_id: string; title: string }) => {
      const { error } = await supabase.from('subtasks').insert({ topic_id, title });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('subtasks').update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subtasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
  });

  const addProgressEntry = useMutation({
    mutationFn: async ({ topic_id, content }: { topic_id: string; content: string }) => {
      const { error } = await supabase.from('progress_entries').insert({ topic_id, content });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
  });

  const updateSubtask = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('subtasks').update(data).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['topics'] });
      const previousTopics = queryClient.getQueryData<TopicWithSubtasks[]>(['topics']);
      queryClient.setQueryData<TopicWithSubtasks[]>(['topics'], (old = []) =>
        old.map((topic) => ({
          ...topic,
          subtasks: topic.subtasks.map((subtask) =>
            subtask.id === id ? { ...subtask, ...data } : subtask,
          ),
        })),
      );
      return { previousTopics };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTopics) {
        queryClient.setQueryData(['topics'], context.previousTopics);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['topics'] }),
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
    updateSubtask,
  };
}
