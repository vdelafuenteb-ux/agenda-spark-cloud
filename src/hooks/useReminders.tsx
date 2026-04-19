import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  recurrence_type: 'monthly' | 'weekly' | 'monthly_weekday' | 'last_business_day';
  recurrence_day: number;
  recurrence_week: number | null;
  recurrence_months: number;
  color: string;
  created_at: string;
}

export function useReminders() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return [] as Reminder[];
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      const list = (data || []) as Reminder[];
      return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['reminders'] });

  const createReminder = useMutation({
    mutationFn: async (r: Omit<Reminder, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('reminders')
        .insert({ ...r, user_id: user!.id, workspace_id: activeWorkspaceId })
        .select()
        .single();
      if (error) throw error;
      return data as Reminder;
    },
    onSuccess: invalidate,
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['reminders'] });
      const prev = qc.getQueryData<Reminder[]>(['reminders']);
      qc.setQueryData<Reminder[]>(['reminders'], (old) => old?.filter((r) => r.id !== id) ?? []);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['reminders'], ctx.prev);
    },
    onSettled: invalidate,
  });

  return { reminders, isLoading, createReminder, deleteReminder };
}
