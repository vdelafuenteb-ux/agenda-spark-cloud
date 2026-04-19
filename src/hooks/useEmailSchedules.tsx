import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface EmailSchedule {
  id: string;
  user_id: string;
  enabled: boolean;
  day_of_week: number;
  send_hour: number;
  send_minute: number;
  send_to_all_assignees: boolean;
  selected_assignee_ids: string[];
  send_all_topics: boolean;
  selected_topic_ids: string[];
  created_at: string;
  updated_at: string;
}

export function useEmailSchedules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const query = useQuery({
    queryKey: ['email_schedules', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async (): Promise<EmailSchedule[]> => {
      if (!activeWorkspaceId) return [];
      const { data, error } = await supabase
        .from('email_schedules')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      const list = (data || []) as unknown as EmailSchedule[];
      return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const upsertSchedule = useMutation({
    mutationFn: async (schedule: Partial<EmailSchedule> & { id?: string }) => {
      if (!user || !activeWorkspaceId) throw new Error('No hay workspace activo');

      if (schedule.id) {
        const { error } = await supabase
          .from('email_schedules')
          .update({
            enabled: schedule.enabled,
            day_of_week: schedule.day_of_week,
            send_hour: schedule.send_hour,
            send_minute: schedule.send_minute,
            send_to_all_assignees: schedule.send_to_all_assignees,
            selected_assignee_ids: schedule.selected_assignee_ids,
            send_all_topics: schedule.send_all_topics,
            selected_topic_ids: schedule.selected_topic_ids,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', schedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_schedules')
          .insert({
            user_id: user.id,
            workspace_id: activeWorkspaceId,
            enabled: schedule.enabled ?? false,
            day_of_week: schedule.day_of_week ?? 1,
            send_hour: schedule.send_hour ?? 9,
            send_minute: schedule.send_minute ?? 0,
            send_to_all_assignees: schedule.send_to_all_assignees ?? true,
            selected_assignee_ids: schedule.selected_assignee_ids ?? [],
            send_all_topics: schedule.send_all_topics ?? true,
            selected_topic_ids: schedule.selected_topic_ids ?? [],
          } as any)
          .select()
          .single();
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email_schedules'] }),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email_schedules'] }),
  });

  return {
    schedules: query.data || [],
    isLoading: query.isLoading,
    upsertSchedule,
    deleteSchedule,
  };
}
