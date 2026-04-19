import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

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
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const assigneesQuery = useQuery({
    queryKey: ['assignees', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async (): Promise<Assignee[]> => {
      if (!activeWorkspaceId) return [];
      const { data, error } = await supabase
        .from('assignees')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      const list = (data || []) as unknown as Assignee[];
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assignees'] });

  const createAssignee = useMutation({
    mutationFn: async (input: string | { name: string; email?: string | null; department_id?: string | null }) => {
      if (!user || !activeWorkspaceId) throw new Error('No hay workspace activo');
      const params = typeof input === 'string' ? { name: input } : input;
      const normalizedEmail = typeof params.email === 'string' ? params.email.trim() : params.email;
      const insertObj = {
        user_id: user.id,
        workspace_id: activeWorkspaceId,
        name: params.name.trim(),
        email: normalizedEmail ? normalizedEmail : null,
        department_id: params.department_id || null,
      };
      const { data, error } = await supabase
        .from('assignees')
        .insert(insertObj)
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
      if (email !== undefined) updateData.email = typeof email === 'string' ? (email.trim() || null) : email;
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
    // Optimistic removal — UI updates instantly while the request flies.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['assignees'] });
      const previous = queryClient.getQueriesData<Assignee[]>({ queryKey: ['assignees'] });
      queryClient.setQueriesData<Assignee[]>({ queryKey: ['assignees'] }, (old) => (old ?? []).filter((a) => a.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      ctx?.previous?.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: invalidate,
  });

  return {
    assignees: assigneesQuery.data || [],
    isLoading: assigneesQuery.isLoading,
    createAssignee,
    updateAssignee,
    deleteAssignee,
  };
}
