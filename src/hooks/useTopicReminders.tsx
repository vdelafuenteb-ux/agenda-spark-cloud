import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TopicReminder {
  id: string;
  user_id: string;
  topic_id: string;
  reminder_date: string;
  note: string;
  sent: boolean;
  created_at: string;
}

export function useTopicReminders(topicId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ['topic_reminders', topicId];

  const { data: reminders = [], isLoading } = useQuery({
    queryKey,
    enabled: !!user && !!topicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('topic_reminders')
        .select('*')
        .eq('topic_id', topicId)
        .order('reminder_date', { ascending: true });
      if (error) throw error;
      return data as TopicReminder[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const createReminder = useMutation({
    mutationFn: async (r: { reminder_date: string; note: string }) => {
      const { data, error } = await supabase
        .from('topic_reminders')
        .insert({ topic_id: topicId, user_id: user!.id, ...r })
        .select()
        .single();
      if (error) throw error;
      return data as TopicReminder;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(`Error al crear recordatorio: ${e.message}`),
  });

  const updateReminder = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; reminder_date?: string; note?: string }) => {
      const { error } = await supabase
        .from('topic_reminders')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(`Error al actualizar recordatorio: ${e.message}`),
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('topic_reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<TopicReminder[]>(queryKey);
      qc.setQueryData<TopicReminder[]>(queryKey, (old) => old?.filter((r) => r.id !== id) ?? []);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error('Error al eliminar recordatorio');
    },
    onSettled: invalidate,
  });

  return { reminders, isLoading, createReminder, updateReminder, deleteReminder };
}
