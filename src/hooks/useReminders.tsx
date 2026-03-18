import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  recurrence_type: 'monthly' | 'weekly' | 'monthly_weekday' | 'last_business_day';
  recurrence_day: number;
  recurrence_week: number | null;
  color: string;
  created_at: string;
}

export function useReminders() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Reminder[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['reminders'] });

  const createReminder = useMutation({
    mutationFn: async (r: Omit<Reminder, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('reminders')
        .insert({ ...r, user_id: user!.id })
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
