import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Reschedule {
  id: string;
  user_id: string;
  topic_id: string;
  previous_date: string | null;
  new_date: string | null;
  reason: string;
  is_external: boolean;
  created_at: string;
}

export function useReschedules() {
  const queryClient = useQueryClient();

  const reschedulesQuery = useQuery({
    queryKey: ['topic_reschedules'],
    queryFn: async (): Promise<Reschedule[]> => {
      const { data, error } = await supabase
        .from('topic_reschedules' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Reschedule[];
    },
  });

  const createReschedule = useMutation({
    mutationFn: async (params: {
      user_id: string;
      topic_id: string;
      previous_date: string | null;
      new_date: string | null;
      reason: string;
      is_external: boolean;
    }) => {
      const { error } = await supabase
        .from('topic_reschedules' as any)
        .insert(params as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic_reschedules'] });
    },
  });

  // Group by topic_id for easy lookup
  const byTopic = new Map<string, Reschedule[]>();
  for (const r of reschedulesQuery.data || []) {
    const arr = byTopic.get(r.topic_id);
    if (arr) arr.push(r);
    else byTopic.set(r.topic_id, [r]);
  }

  return {
    reschedules: reschedulesQuery.data || [],
    reschedulesByTopic: byTopic,
    isLoading: reschedulesQuery.isLoading,
    createReschedule,
  };
}
