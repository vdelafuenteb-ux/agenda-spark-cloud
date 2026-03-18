import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationEmail {
  id: string;
  user_id: string;
  topic_id: string;
  assignee_name: string;
  assignee_email: string;
  sent_at: string;
  responded: boolean;
  responded_at: string | null;
}

export function useNotificationEmails(topicId?: string) {
  const queryClient = useQueryClient();

  const emailsQuery = useQuery({
    queryKey: ['notification_emails', topicId],
    queryFn: async (): Promise<NotificationEmail[]> => {
      let query = supabase
        .from('notification_emails')
        .select('*')
        .order('sent_at', { ascending: false });
      if (topicId) {
        query = query.eq('topic_id', topicId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as NotificationEmail[];
    },
    enabled: !!topicId,
  });

  const logEmail = useMutation({
    mutationFn: async (params: { topic_id: string; assignee_name: string; assignee_email: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('notification_emails')
        .insert({
          user_id: user.id,
          topic_id: params.topic_id,
          assignee_name: params.assignee_name,
          assignee_email: params.assignee_email,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as NotificationEmail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
    },
  });

  const deleteEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_emails').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
    },
  });

  const toggleResponded = useMutation({
    mutationFn: async ({ id, responded }: { id: string; responded: boolean }) => {
      const { error } = await supabase
        .from('notification_emails')
        .update({
          responded,
          responded_at: responded ? new Date().toISOString() : null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
    },
  });

  return {
    emails: emailsQuery.data || [],
    isLoading: emailsQuery.isLoading,
    logEmail,
    toggleResponded,
    deleteEmail,
  };
}
