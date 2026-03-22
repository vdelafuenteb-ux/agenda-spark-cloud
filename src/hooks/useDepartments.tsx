import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Department {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export function useDepartments() {
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase
        .from('departments' as any)
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Department[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments'] });

  const createDepartment = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      const { data, error } = await supabase
        .from('departments' as any)
        .insert({ name, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Department;
    },
    onSuccess: invalidate,
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('departments' as any)
        .update({ name } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departments' as any)
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
