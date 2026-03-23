import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Assignee {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  created_at: string;
  weekly_capacity: number;
}

export function useAssignees() {
  const queryClient = useQueryClient();

  const assigneesQuery = useQuery({
    queryKey: ['assignees'],
    queryFn: async (): Promise<Assignee[]> => {
      const { data, error } = await supabase
        .from('assignees')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Assignee[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assignees'] });

  const createAssignee = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('assignees')
        .insert({ user_id: user.id, name: name.trim() })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Assignee;
    },
    onSuccess: invalidate,
  });

  const updateAssignee = useMutation({
    mutationFn: async ({ id, name, email }: { id: string; name?: string; email?: string | null }) => {
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (email !== undefined) updateData.email = email;
      const { error } = await supabase.from('assignees').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteAssignee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    assignees: assigneesQuery.data || [],
    isLoading: assigneesQuery.isLoading,
    createAssignee,
    updateAssignee,
    deleteAssignee,
  };
}
