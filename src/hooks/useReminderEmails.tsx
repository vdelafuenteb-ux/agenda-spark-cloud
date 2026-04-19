import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

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
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const query = useQuery({
    queryKey: ['reminder_emails', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async (): Promise<ReminderEmail[]> => {
      if (!activeWorkspaceId) return [];
      const { data, error } = await supabase
        .from('reminder_emails' as any)
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      const list = (data || []) as unknown as ReminderEmail[];
      return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const upsertReminderEmail = useMutation({
    mutationFn: async (item: Partial<ReminderEmail> & { id?: string }) => {
      if (!user || !activeWorkspaceId) throw new Error('No hay workspace activo');

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
            workspace_id: activeWorkspaceId,
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
