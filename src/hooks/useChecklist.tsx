import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChecklistItem {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

export function useChecklist() {
  const qc = useQueryClient();
  const key = ['checklist_items'];

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ChecklistItem[]> => {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const addItem = useMutation({
    mutationFn: async (title: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('checklist_items')
        .insert({ user_id: user.id, title: title.trim() });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('checklist_items')
        .update({ completed })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const clearCompleted = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('checklist_items')
        .delete()
        .eq('user_id', user.id)
        .eq('completed', true);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    addItem,
    toggleItem,
    deleteItem,
    clearCompleted,
  };
}
