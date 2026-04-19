import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

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
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const reschedulesQuery = useQuery({
    queryKey: ['topic_reschedules', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async (): Promise<Reschedule[]> => {
      if (!activeWorkspaceId) return [];
      const { data, error } = await supabase
        .from('topic_reschedules' as any)
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      const list = (data || []) as unknown as Reschedule[];
      return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
        .insert({ ...params, workspace_id: activeWorkspaceId } as any);
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
