import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logEvent } from './events';
import type { WorkEdgeType, WorkNodeType, WorkRelationship } from './types';

// task_relationships is a generic edge store: any source node type can link to
// any target node type with a chosen edge type. Used for manual declarations
// like "this task depends on that one", "blocked by Operaciones", etc.
//
// We fetch the full collection (cross-workspace) because the WorkGraph itself
// can run in global mode. Callers that want a workspace-scoped view filter
// client-side.
const QUERY_KEY = ['work_graph_relationships'] as const;

export interface CreateRelationshipInput {
  source_type: WorkNodeType;
  source_id: string;
  target_type: WorkNodeType;
  target_id: string;
  edge_type: WorkEdgeType;
  reason?: string;
  weight?: number;
  workspace_id?: string | null;
}

export function useWorkGraphRelationships() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<WorkRelationship[]> => {
      const { data, error } = await supabase.from('task_relationships').select('*');
      if (error) throw error;
      return ((data || []) as unknown as WorkRelationship[]);
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const createRelationship = useMutation({
    mutationFn: async (input: CreateRelationshipInput) => {
      if (!user) throw new Error('No autenticado');
      const payload = {
        source_type: input.source_type,
        source_id: input.source_id,
        target_type: input.target_type,
        target_id: input.target_id,
        edge_type: input.edge_type,
        reason: input.reason?.trim() || null,
        weight: input.weight ?? 1,
        workspace_id: input.workspace_id ?? null,
        created_by: user.id,
      };
      const { data, error } = await supabase.from('task_relationships').insert(payload).select().single();
      if (error) throw error;
      logEvent({
        type: 'dependency.added',
        workspace_id: input.workspace_id ?? null,
        actor_id: user.id,
        actor_email: user.email ?? null,
        target_id: input.source_id,
        target_type: input.source_type,
        payload: {
          edge_type: input.edge_type,
          target_id: input.target_id,
          target_type: input.target_type,
          reason: input.reason,
        },
      });
      return data as unknown as WorkRelationship;
    },
    onSuccess: invalidate,
  });

  const updateRelationship = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; edge_type?: WorkEdgeType; reason?: string | null; weight?: number | null }) => {
      const updateData: Record<string, unknown> = {};
      if (patch.edge_type !== undefined) updateData.edge_type = patch.edge_type;
      if (patch.reason !== undefined) updateData.reason = patch.reason;
      if (patch.weight !== undefined) updateData.weight = patch.weight;
      const { error } = await supabase.from('task_relationships').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteRelationship = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_relationships').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<WorkRelationship[]>(QUERY_KEY);
      qc.setQueryData<WorkRelationship[]>(QUERY_KEY, (old) => (old ?? []).filter((r) => r.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev); },
    onSettled: invalidate,
  });

  return {
    relationships: query.data ?? [],
    isLoading: query.isLoading,
    createRelationship,
    updateRelationship,
    deleteRelationship,
  };
}
