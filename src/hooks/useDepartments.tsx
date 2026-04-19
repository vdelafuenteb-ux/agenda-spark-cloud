import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { Tables } from '@/integrations/supabase/types';

export type Department = Tables<'departments'>;

export function useDepartments() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const departmentsQuery = useQuery({
    queryKey: ['departments', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async (): Promise<Department[]> => {
      if (!activeWorkspaceId) return [];
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      const list = (data || []) as Department[];
      return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments'] });

  const createDepartment = useMutation({
    mutationFn: async (name: string) => {
      if (!user || !activeWorkspaceId) throw new Error('No hay workspace activo');
      const { data, error } = await supabase
        .from('departments')
        .insert({ name, user_id: user.id, workspace_id: activeWorkspaceId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('departments')
        .update({ name })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    departments: departmentsQuery.data || [],
    isLoading: departmentsQuery.isLoading,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  };
}
