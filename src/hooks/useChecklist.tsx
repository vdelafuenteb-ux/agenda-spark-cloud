import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChecklistItem {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
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
    mutationFn: async ({ title, due_date }: { title: string; due_date?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('checklist_items')
        .insert({ user_id: user.id, title: title.trim(), due_date: due_date ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as ChecklistItem;
    },
    onMutate: async ({ title, due_date }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChecklistItem[]>(key);
      const optimistic: ChecklistItem = {
        id: crypto.randomUUID(),
        user_id: '',
        title: title.trim(),
        completed: false,
        due_date: due_date ?? null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<ChecklistItem[]>(key, (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; completed?: boolean; due_date?: string | null }) => {
      const { error } = await supabase
        .from('checklist_items')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChecklistItem[]>(key);
      qc.setQueryData<ChecklistItem[]>(key, (old = []) =>
        old.map((i) => (i.id === id ? { ...i, ...data } : i)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('checklist_items')
        .update({ completed })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, completed }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChecklistItem[]>(key);
      qc.setQueryData<ChecklistItem[]>(key, (old = []) =>
        old.map((i) => (i.id === id ? { ...i, completed } : i)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChecklistItem[]>(key);
      qc.setQueryData<ChecklistItem[]>(key, (old = []) => old.filter((i) => i.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
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
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChecklistItem[]>(key);
      qc.setQueryData<ChecklistItem[]>(key, (old = []) => old.filter((i) => !i.completed));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
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
