import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Assignee {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  created_at: string;
  weekly_capacity: number;
  department_id: string | null;
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
    mutationFn: async (input: string | { name: string; email?: string; department_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const params = typeof input === 'string' ? { name: input } : input;
      const insertData: Record<string, any> = { user_id: user.id, name: params.name.trim() };
      if (params.email) insertData.email = params.email;
      if (params.department_id) insertData.department_id = params.department_id;
      const { data, error } = await supabase
        .from('assignees')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Assignee;
    },
    onSuccess: invalidate,
  });

  const updateAssignee = useMutation({
    mutationFn: async ({ id, name, email, weekly_capacity, department_id }: { id: string; name?: string; email?: string | null; weekly_capacity?: number; department_id?: string | null }) => {
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (email !== undefined) updateData.email = email;
      if (weekly_capacity !== undefined) updateData.weekly_capacity = weekly_capacity;
      if (department_id !== undefined) updateData.department_id = department_id;
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
