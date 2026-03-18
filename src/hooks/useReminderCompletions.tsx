import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ReminderCompletion {
  id: string;
  reminder_id: string;
  completed_date: string;
  user_id: string;
  created_at: string;
}

export function useReminderCompletions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: completions = [] } = useQuery({
    queryKey: ['reminder_completions'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_completions')
        .select('*');
      if (error) throw error;
      return data as ReminderCompletion[];
    },
  });

  const completionSet = new Set(
    completions.map((c) => `${c.reminder_id}_${c.completed_date}`)
  );

  const isCompleted = (reminderId: string, date: string) =>
    completionSet.has(`${reminderId}_${date}`);

  const toggleCompletion = useMutation({
    mutationFn: async ({ reminder_id, completed_date }: { reminder_id: string; completed_date: string }) => {
      const existing = completions.find(
        (c) => c.reminder_id === reminder_id && c.completed_date === completed_date
      );
      if (existing) {
        const { error } = await supabase.from('reminder_completions').delete().eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reminder_completions').insert({
          reminder_id,
          completed_date,
          user_id: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminder_completions'] }),
  });

  return { completions, isCompleted, toggleCompletion };
}
