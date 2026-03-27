import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkerIncident {
  id: string;
  user_id: string;
  assignee_name: string;
  assignee_email: string;
  category: 'leve' | 'moderada' | 'grave';
  title: string;
  description: string;
  incident_date: string;
  email_sent: boolean;
  email_sent_at: string | null;
  created_at: string;
}

export function useIncidents(assigneeName: string) {
  const queryClient = useQueryClient();
  const queryKey = ['worker_incidents', assigneeName];

  const { data: incidents = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_incidents' as any)
        .select('*')
        .eq('assignee_name', assigneeName)
        .order('incident_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WorkerIncident[];
    },
    enabled: !!assigneeName,
  });

  const createIncident = useMutation({
    mutationFn: async (incident: {
      assignee_name: string;
      assignee_email: string;
      category: 'leve' | 'moderada' | 'grave';
      title: string;
      description: string;
      incident_date: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      const { error } = await supabase
        .from('worker_incidents' as any)
        .insert({ ...incident, user_id: user.id } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteIncident = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('worker_incidents' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markEmailSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('worker_incidents' as any)
        .update({ email_sent: true, email_sent_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { incidents, isLoading, createIncident, deleteIncident, markEmailSent };
}
