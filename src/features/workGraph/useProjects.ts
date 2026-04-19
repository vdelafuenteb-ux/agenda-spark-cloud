import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ProjectEntity } from './types';

// Projects live in a GLOBAL Firestore collection (no workspace_id): any
// approved user across any workspace reads the same list. This lets a task
// in workspace A impact the same `project` as a task in workspace B — which
// is the whole point of the "Cerebro Operativo" cross-workspace view.
const QUERY_KEY = ['projects', 'global'] as const;

export function useProjects() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ProjectEntity[]> => {
      const { data, error } = await supabase.from('projects').select('*');
      if (error) throw error;
      const list = (data || []) as unknown as ProjectEntity[];
      return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const createProject = useMutation({
    mutationFn: async (input: { name: string; description?: string; color?: string; client_id?: string | null }) => {
      if (!user) throw new Error('No autenticado');
      const payload = {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color || '#8b5cf6',
        client_id: input.client_id || null,
        owner_user_id: user.id,
        archived: false,
      };
      const { data, error } = await supabase.from('projects').insert(payload).select().single();
      if (error) throw error;
      return data as unknown as ProjectEntity;
    },
    onSuccess: invalidate,
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; description?: string | null; color?: string | null; client_id?: string | null; archived?: boolean }) => {
      const updateData: Record<string, unknown> = {};
      if (patch.name !== undefined) updateData.name = patch.name.trim();
      if (patch.description !== undefined) updateData.description = patch.description;
      if (patch.color !== undefined) updateData.color = patch.color;
      if (patch.client_id !== undefined) updateData.client_id = patch.client_id;
      if (patch.archived !== undefined) updateData.archived = patch.archived;
      const { error } = await supabase.from('projects').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    // Optimistic removal so the Settings list updates instantly.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<ProjectEntity[]>(QUERY_KEY);
      qc.setQueryData<ProjectEntity[]>(QUERY_KEY, (old) => (old ?? []).filter((p) => p.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev); },
    onSettled: invalidate,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    createProject,
    updateProject,
    deleteProject,
  };
}
