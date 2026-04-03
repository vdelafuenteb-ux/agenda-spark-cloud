import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReminderEmail {
  id: string;
  user_id: string;
  enabled: boolean;
  day_of_week: number;
  send_hour: number;
  message: string;
  subject: string;
  recipient_emails: string[];
  created_at: string;
  updated_at: string;
}

export function useReminderEmails() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['reminder_emails'],
    queryFn: async (): Promise<ReminderEmail[]> => {
      const { data, error } = await supabase
        .from('reminder_emails' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ReminderEmail[];
    },
  });

  const upsertReminderEmail = useMutation({
    mutationFn: async (item: Partial<ReminderEmail> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (item.id) {
        const { error } = await supabase
          .from('reminder_emails' as any)
          .update({
            enabled: item.enabled,
            day_of_week: item.day_of_week,
            send_hour: item.send_hour,
            message: item.message,
            subject: item.subject,
            recipient_emails: item.recipient_emails,
          } as any)
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reminder_emails' as any)
          .insert({
            user_id: user.id,
            enabled: item.enabled ?? false,
            day_of_week: item.day_of_week ?? 4,
            send_hour: item.send_hour ?? 9,
            message: item.message ?? '',
            subject: item.subject ?? 'Recordatorio semanal',
            recipient_emails: item.recipient_emails ?? [],
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminder_emails'] }),
  });

  const deleteReminderEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminder_emails' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminder_emails'] }),
  });

  return {
    reminderEmails: query.data || [],
    isLoading: query.isLoading,
    upsertReminderEmail,
    deleteReminderEmail,
  };
}
